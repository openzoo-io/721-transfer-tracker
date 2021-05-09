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
  let scs = new Map()
  let totalSupplies = new Map()
  let promises = contracts.map(async (contract) => {
    let sc = contractutils.loadContractFromAddress(contract.address)
    scs.set(contract.address, sc)
    let totalSupply = await sc.totalSupply()
    totalSupplies.set(contract.address, totalSupply)
  })
  await Promise.all(promises)

  contracts.map(async (contract) => {
    let sc = scs.get(contract.address)
    let ts = totalSupplies.get(contract.address)
    const func = async (i) => {
      if (i > ts) return

      let tk = await ERC721TOKEN.find({
        contractAddress: contract.address,
        tokenID: i,
      })
      if (tk) {
        let owner = await sc.ownerOf(i)
        let to = tk.owner
        if (to != owner) {
          tk.owner = to
          await tk.save()
        }
      } else {
        let tokenURI = await sc.tokenURI(i)
        if (tokenURI.startsWith('https://')) {
          let newTk = new ERC721TOKEN()
          newTk.contractAddress = contract.address
          newTk.tokenID = tokenID
          newTk.tokenURI = tokenURI
          newTk.owner = to
          await newTk.save()
        }
      }
      func(i + 1)
    }
    func(1)
  })
}

const _trackERC721Distribution = async (contracts) => {
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
