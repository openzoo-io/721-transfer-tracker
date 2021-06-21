require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const ethers = require('ethers')

let rpcapi = process.env.MAINNET_RPC

const provider = new ethers.providers.JsonRpcProvider(rpcapi, 250)

const ERC721CONTRACT = mongoose.model('ERC721CONTRACT')
const Category = mongoose.model('Category')
const NFTITEM = mongoose.model('NFTITEM')
const BannedNFT = mongoose.model('BannedNFT')

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
    if (tnxs) {
      let last = tnxs[tnxs.length - 1]
      end = parseInt(last.blockNumber)
    }

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
            trackedContracts.push(sc)
            console.log(trackedAddresses)
            sc.on('Transfer', async (from, to, tokenID) => {
              try {
                from = toLowerCase(from)
                to = toLowerCase(to)
                let tokenURI = await sc.tokenURI(tokenID)
                if (!tokenURI.startsWith('https://')) return
                let erc721token = await NFTITEM.findOne({
                  contractAddress: contractInfo.address,
                  tokenID: tokenID,
                })
                let metadata = await axios.get(tokenURI)
                let tokenName = ''
                try {
                  tokenName = metadata.data.name
                } catch (error) {}

                if (erc721token) {
                  if (erc721token.owner != to) {
                    erc721token.owner = to
                    let now = Date.now()
                    try {
                      if (erc721token.createdAt > now)
                        erc721token.createdAt = now
                    } catch (error) {}
                    await erc721token.save()
                  }
                } else {
                  let bannedToken = await BannedNFT.findOne({
                    contractAddress: contractInfo.address,
                    tokenID: tokenID,
                  })
                  if (bannedToken) {
                  } else {
                    let newTk = new NFTITEM()
                    newTk.contractAddress = contractInfo.address
                    newTk.tokenID = tokenID
                    newTk.name = tokenName
                    newTk.tokenURI = tokenURI
                    newTk.owner = to
                    newTk.createdAt = Date.now()
                    await newTk.save()
                  }
                }
              } catch (error) {
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
      }, 1000 * 1)
    } catch (error) {}
  }
  await func()
}

const Tracker = {
  trackedContracts,
  trackAll721s,
}

module.exports = Tracker
