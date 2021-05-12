require('dotenv').config()
const mongoose = require('mongoose')
const contractutils = require('./contract.utils')

require('../models/erc721token')
const ERC721TOKEN = mongoose.model('ERC721TOKEN')

const trackCollectionTransfer = (address) => {
  console.log(`on transfer of ${address} started`)
  let contract = contractutils.loadContractFromAddress(address)
  if (!contract) return null
  contract.on('Transfer', async (from, to, tokenID) => {
    console.log('transfer')
    console.log(from, to, tokenID)
    let tokenURI = await contract.tokenURI(tokenID)
    if (!tokenURI.startsWith('https://')) return
    let erc721token = await ERC721TOKEN.findOne({
      contractAddress: address,
      tokenID: tokenID,
    })

    if (erc721token) {
      console.log('tk exists')
      console.log(erc721token)
      if (erc721token.owner != to) {
        erc721token.owner = to
        await erc721token.save()
      }
    } else {
      let newTk = new ERC721TOKEN()
      newTk.contractAddress = address
      newTk.tokenID = tokenID
      newTk.tokenURI = tokenURI
      newTk.owner = to
      let test = await newTk.save()
      console.log('tk newly saved')
      console.log(test)
    }
  })
  return contract
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
          console.log(contract.address, totalSupply)
          totalSupplies.set(contract.address, totalSupply)
          scs.set(contract.address, sc)
        } catch (error) {}
      })
      await Promise.all(promises)
    } catch (error) {}
    console.log(scs.size)
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
              console.log('error')
              console.log(totalSupplies.get(contract.address))
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
  trackCollectionTransfer,
  trackERC721Distribution,
}

module.exports = collectionTracker
