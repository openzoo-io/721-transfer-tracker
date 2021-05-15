require('dotenv').config()
const mongoose = require('mongoose')
const contractutils = require('./contract.utils')
const Tracker = require('./erc721tracker')
const Contracts = Tracker.trackedContracts

require('../models/erc721token')
const ERC721TOKEN = mongoose.model('ERC721TOKEN')

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

const trackERC721Distribution = async (contracts) => {
  try {
    let scs = new Map()
    let totalSupplies = new Map()
    try {
      let promises = contracts.map(async (contract) => {
        let sc = contractutils.loadContractFromAddress(contract.address)
        try {
          let totalSupply = await sc.totalSupply()
          totalSupply = parseFloat(totalSupply.toString())
          totalSupplies.set(contract.address, totalSupply)
          scs.set(contract.address, sc)
        } catch (error) {}
      })
      await Promise.all(promises)
    } catch (error) {}
    let total = contracts.length
    let tokenID = 1
    while (total > 0) {
      const promises = contracts.map(async (contract) => {
        let sc = scs.get(contract.address)
        if (sc) {
          let supply = totalSupplies.get(contract.address)
          if (supply >= tokenID) {
            try {
              let tokenURI = await sc.tokenURI(tokenID)
              if (!tokenURI.startsWith('https://')) {
              } else {
                let to = await sc.ownerOf(tokenID)
                to = toLowerCase(to)
                let erc721token = await ERC721TOKEN.findOne({
                  contractAddress: contract.address,
                  tokenID: tokenID,
                })
                if (erc721token) {
                  if (erc721token.owner != to) {
                    erc721token.owner = to
                    await erc721token.save()
                  }
                } else {
                  if (tokenURI.startsWith('https://')) {
                    let newTk = new ERC721TOKEN()
                    newTk.contractAddress = contract.address
                    newTk.tokenID = tokenID
                    newTk.tokenURI = tokenURI
                    newTk.owner = to
                    await newTk.save()
                  }
                }
              }
            } catch (error) {
              totalSupplies.set(contract.address, 0)
              total--
            }
          }
        }
      })
      await Promise.all(promises)
      tokenID++
    }
  } catch (error) {}
}

const collectionTracker = {
  trackERC721Distribution,
}

module.exports = collectionTracker
