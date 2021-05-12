require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const ethers = require('ethers')

let rpcapi = process.env.MAINNET_RPC

const provider = new ethers.providers.JsonRpcProvider(rpcapi, 250)

require('../models/erc721contract')
const ERC721CONTRACT = mongoose.model('ERC721CONTRACT')
const Category = mongoose.model('Category')
const collectionTracker = require('./collectiontracker')

const ftmScanApiKey = process.env.FTM_SCAN_API_KEY
const validatorAddress = process.env.VALIDATORADDRESS
const limit = 99999999999

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

let trackedAddresses = []

const trackerc721 = async (begin, end) => {
  let contracts = new Array()

  let request = `https://api.ftmscan.com/api?module=account&action=tokennfttx&address=${validatorAddress}&startblock=${begin}&endblock=${end}&sort=asc&apikey=${ftmScanApiKey}`
  let result = await axios.get(request)
  let tnxs = result.data.result

  if (tnxs.length == 0) return end
  if (tnxs) {
    console.log('new transfer')
    let promises = tnxs.map(async (tnx) => {
      let contractInfo = {
        address: toLowerCase(tnx.contractAddress),
        name: tnx.tokenName,
        symbol: tnx.tokenSymbol,
      }
      if (
        !contracts.some((contract) => contract.address == contractInfo.address)
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
          if (!trackedAddresses.includes(contractInfo.address)) {
            trackedAddresses.push(contractInfo.address)
            console.log('tracked', contractInfo.address)
            collectionTracker.trackCollectionTransfer(contractInfo.address)
          }
        }
      }
    })
    await Promise.all(promises)
    await collectionTracker.trackERC721Distribution(contracts)
  }

  return end
}

let start = 1

const trackAll721s = async () => {
  const func = async () => {
    let currentBlockHeight = await provider.getBlockNumber()

    start = await trackerc721(start, currentBlockHeight)
    if (currentBlockHeight > limit) start = 0

    setTimeout(async () => {
      await func()
    }, 1000 * 1)
  }

  await func()
}

module.exports = trackAll721s
