require('dotenv').config()
const mongoose = require('mongoose')
const contractutils = require('./contract.utils')

require('../models/transferhistory')
require('../models/erc721token')
const TransferHistory = mongoose.model('TransferHistory')
const ERC721TOKEN = mongoose.model('ERC721TOKEN')

const trackCollectionTransfer = async (address) => {
  console.log(`on transfer of ${address} started`)
  let contract = contractutils.loadContractFromAddress(address)
  if (!contract) return null
  contract.on('Transfer', async (from, to, tokenID) => {
    let tokenURI = await contract.tokenURI(tokenID)
    if (!tokenURI.startsWith('https://')) return
    let erc721token = await ERC721TOKEN.findOne({
      contractAddress: address,
      tokenID: tokenID,
    })

    if (erc721token) {
      erc721token.owner = to
      await erc721token.save()
    } else {
      let newTk = new ERC721TOKEN()
      newTk.contractAddress = address
      newTk.tokenID = tokenID
      newTk.tokenURI = tokenURI
      newTk.owner = to
      await newTk.save()
    }

    let history = await TransferHistory.findOne({
      collectionAddress: address,
      tokenID: tokenID,
      to: from,
    })
    if (history) {
      history.from = from
      history.to = to
      await history.save()
    } else {
      let newHistory = new TransferHistory()
      newHistory.collectionAddress = address
      newHistory.from = from
      newHistory.to = to
      newHistory.tokenID = tokenID
      await newHistory.save()
    }
  })
  return contract
}

const trackERC721Distribution = async (contracts) => {
  let scs = new Map()
  let totalSupplies = new Map()
  contracts.map((contract) => {
    scs.set(
      contract.address,
      contractutils.loadContractFromAddress(contract.address),
    )
    totalSupplies.set(contract.address, 1)
  })

  let total = contracts.length
  let tokenID = 1
  while (total > 0) {
    const promises = contracts.map(async (contract) => {
      let sc = scs.get(contract.address)
      let supply = totalSupplies.get(contract.address)
      if (supply == 1) {
        try {
          let tokenURI = await sc.tokenURI(tokenID)
          let from = contract.address
          if (!tokenURI.startsWith('https://')) {
          } else {
            let to = await sc.ownerOf(tokenID)
            let erc721token = await ERC721TOKEN.findOne({
              contractAddress: contract.address,
              tokenID: tokenID,
            })
            if (erc721token) {
              erc721token.owner = from
              await erc721token.save()
            } else {
              if (tokenURI.startsWith('https://')) {
                let newTk = new ERC721TOKEN()
                newTk.contractAddress = contract.address
                newTk.tokenID = tokenID
                newTk.tokenURI = tokenURI
                newTk.owner = from
                await newTk.save()
              }
            }
            let history = await TransferHistory.findOne({
              collectionAddress: contract.address,
              tokenID: tokenID,
              to: from,
            })
            if (history) {
              history.from = from
              history.to = to
              await token.save()
            } else {
              let newHistory = new TransferHistory()
              newHistory.collectionAddress = contract.address
              newHistory.from = from
              newHistory.to = to
              newHistory.tokenID = tokenID
              await newHistory.save()
            }
          }
        } catch (error) {
          totalSupplies.set(contract.address, 0)
          total--
        }
      }
    })
    await Promise.all(promises)
    tokenID++
  }
}

const collectionTracker = {
  trackCollectionTransfer,
  trackERC721Distribution,
}

module.exports = collectionTracker
