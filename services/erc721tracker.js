require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const ethers = require('ethers')

let rpcapi = process.env.MAINNET_RPC

const provider = new ethers.providers.JsonRpcProvider(rpcapi, 250)

require('../models/erc721contract')
const ERC721CONTRACT = mongoose.model('ERC721CONTRACT')
const Category = mongoose.model('Category')
const ERC721TOKEN = mongoose.model('ERC721TOKEN')

const contractutils = require('./contract.utils')

const ftmScanApiKey = process.env.FTM_SCAN_API_KEY
const validatorAddress = process.env.VALIDATORADDRESS
const limit = 99999999999

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

const trackedAddresses = []
const trackedContracts = []

const trackerc721 = async (begin, end) => {
  try {
    let contracts = new Array()

    let request = `https://api.ftmscan.com/api?module=account&action=tokennfttx&address=${validatorAddress}&startblock=${begin}&endblock=${end}&sort=asc&apikey=${ftmScanApiKey}`
    let result = await axios.get(request)
    let tnxs = result.data.result

    if (tnxs.length == 0) return end
    if (tnxs) {
      let promises = tnxs.map(async (tnx) => {
        let contractInfo = {
          address: toLowerCase(tnx.contractAddress),
          name: tnx.tokenName,
          symbol: tnx.tokenSymbol,
        }
        if (
          !contracts.some(
            (contract) => contract.address == contractInfo.address,
          )
        ) {
          if (!trackedAddresses.includes(contractInfo.address)) {
            contracts.push(contractInfo)
            let erc721 = null
            try {
              erc721 = await ERC721CONTRACT.findOne({
                address: contractInfo.address,
              })
            } catch (error) {
              erc721 = null
            }
            if (!erc721) {
              try {
                let minter = new ERC721CONTRACT()
                minter.address = contractInfo.address
                minter.name = contractInfo.name
                minter.symbol = contractInfo.symbol
                await minter.save()
                let category = new Category()
                category.minterAddress = contractInfo.address
                category.type = 721
                await category.save()
              } catch (error) {}
            }
            let sc = contractutils.loadContractFromAddress(contractInfo.address)
            trackedAddresses.push(contractInfo.address)
            console.log(contractInfo.address)
            trackedContracts.push(sc)
            sc.on('Transfer', async (from, to, tokenID) => {
              console.log('transfer')
              console.log(from, to, tokenID)
              try {
                from = toLowerCase(from)
                to = toLowerCase(to)
                let tokenURI = await sc.tokenURI(tokenID)
                if (!tokenURI.startsWith('https://')) return
                let erc721token = await ERC721TOKEN.findOne({
                  contractAddress: contractInfo.address,
                  tokenID: tokenID,
                })

                if (erc721token) {
                  if (erc721token.owner != to) {
                    erc721token.owner = to
                    let _saved = await erc721token.save()
                    console.log('saved is ')
                    console.log(_saved)
                  }
                } else {
                  let newTk = new ERC721TOKEN()
                  newTk.contractAddress = contractInfo.address
                  newTk.tokenID = tokenID
                  newTk.tokenURI = tokenURI
                  newTk.owner = to
                  let _newTkSaved = await newTk.save()
                  console.log('new tk saved is ')
                  console.log(_newTkSaved)
                }
              } catch (error) {
                console.log('on transfer error')
                console.log(error)
              }
            })
          }
        }
      })
      await Promise.all(promises)
    }
    return end
  } catch (error) {}
}

let start = 1

const trackAll721s = async () => {
  const func = async () => {
    try {
      let currentBlockHeight = await provider.getBlockNumber()
      start = await trackerc721(start, currentBlockHeight)
      if (currentBlockHeight > limit) start = 0
      setTimeout(async () => {
        await func()
      }, 1000 * 10)
    } catch (error) {}
  }
  await func()
}

const Tracker = {
  trackedContracts,
  trackAll721s,
}

module.exports = Tracker
