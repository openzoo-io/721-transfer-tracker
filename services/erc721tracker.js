require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const ethers = require('ethers')

let rpcapi = process.env('MAINNET_RPC')

const provider = new ethers.providers.JsonRpcProvider(rpcapi, 250)

require('../models/erc721contract')
const ERC721CONTRACT = mongoose.model('ERC721CONTRACT')
const Category = mongoose.model('Category')
const collectionTracker = require('./collectiontracker')

const ftmScanApiKey = process.env.FTM_SCAN_API_KEY
const validatorAddress = process.env.VALIDATORADDRESS
const limit = 99999999999

const trackListing = require('../services/transactiontracker')
const contractutils = require('../services/contract.utils')

const checkIfHasMinted = async (address) => {
  let sc = contractutils.loadContractFromAddress(address)
  try {
    let totalSupply = await sc.totalSupply()
    console.log(`total supply is ${totalSupply}`, address)
    if (totalSupply > 0) return true
    return false
  } catch (error) {
    console.log(error)
    return false
  }
}

const trackerc721 = async (begin, end) => {
  let contracts = new Array()
  let request = `https://api.ftmscan.com/api?module=account&action=tokennfttx&address=${validatorAddress}&startblock=${begin}&endblock=${end}&sort=asc&apikey=${ftmScanApiKey}`
  let result = await axios.get(request)
  let tnxs = result.data.result

  if (tnxs.length == 0) return end
  if (tnxs) {
    let promises = tnxs.map(async (tnx) => {
      let contractInfo = {
        address: tnx.contractAddress,
        name: tnx.tokenName,
        symbol: tnx.tokenSymbol,
      }
      if (
        !contracts.some((contract) => contract.address == contractInfo.address)
      ) {
        let hasMinted = await checkIfHasMinted(contractInfo.address)
        if (hasMinted) contracts.push(contractInfo)
      }
    })
    await Promise.all(promises)
  }

  const func = async () => {
    // add to db
    const promises = contracts.map(async (contract) => {
      let erc721 = null
      try {
        erc721 = await ERC721CONTRACT.findOne({ address: contract.address })
      } catch (error) {
        erc721 = null
      }
      if (!erc721) {
        let minter = new ERC721CONTRACT()
        minter.address = contract.address
        minter.name = contract.name
        minter.symbol = contract.symbol
        await minter.save()
        let category = new Category()
        category.minterAddress = contract.address
        category.type = 721
        await category.save()
        await collectionTracker.trackCollectionTransfer(contract.address)
      }
    })

    await Promise.all(promises)
  }

  await func()
  await collectionTracker.trackERC721Distribution(contracts)

  return end
}

let start = 0

const trackAll721s = async () => {
  console.log('erc721 tracker has been started')
  trackListing()
  console.log('tnx tracker started')

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
