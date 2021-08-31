require('dotenv').config()
const axios = require('axios')
const mongoose = require('mongoose')
const ethers = require('ethers')

const rpcapi = process.env.NETWORK_RPC
const chainID = parseInt(process.env.NETWORK_CHAINID)
const ftmScanApiURL = process.env.FTM_SCAN_URL

const provider = new ethers.providers.JsonRpcProvider(rpcapi, chainID)

const ERC721CONTRACT = mongoose.model('ERC721CONTRACT')
const Category = mongoose.model('Category')
const NFTITEM = mongoose.model('NFTITEM')

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

    let request = `${ftmScanApiURL}api?module=account&action=tokennfttx&address=${validatorAddress}&startblock=${begin}&endblock=${end}&sort=asc&apikey=${ftmScanApiKey}`
    let result = await axios.get(request)
    let tnxs = result.data.result
    if (tnxs) {
      let last = tnxs[tnxs.length - 1]
      end = parseInt(last.blockNumber)
    }

    let categories = await Category.find({
      minterAddress: { $nin: trackedAddresses },
      type: 721,
    })

    if (tnxs.length == 0) {
      if (categories.length > 0) {
        let promise = categories.map(async (category) => {
          let address = category.minterAddress
          let sc = contractutils.loadContractFromAddress(address)
          trackedAddresses.push(address)
          trackedContracts.push(sc)
          // console.log(trackedAddresses)
          sc.on('Transfer', async (from, to, tokenID) => {
            console.log(from, to, tokenID)
            try {
              from = toLowerCase(from)
              to = toLowerCase(to)
              tokenID = parseInt(tokenID)
              // if (!tokenURI.startsWith('https://')) return
              let erc721token = await NFTITEM.findOne({
                contractAddress: address,
                tokenID: tokenID,
              })

              if (erc721token) {
                if (to == validatorAddress) {
                  await erc721token.remove()
                } else {
                  if (erc721token.owner != to) {
                    erc721token.owner = to
                    let now = Date.now()
                    try {
                      if (erc721token.createdAt > now)
                        erc721token.createdAt = now
                    } catch (error) {
                      console.log('error 11')
                    }
                    await erc721token.save()
                  }
                }
              } else {
                let tokenURI = await sc.tokenURI(tokenID)
                let metadata = await axios.get(tokenURI)
                let tokenName = ''
                let imageURL = ''
                try {
                  tokenName = metadata.data.name
                  imageURL = metadata.data.image
                } catch (error) {
                  console.log('error 10')
                }
                if (to == validatorAddress) {
                } else {
                  let newTk = new NFTITEM()
                  newTk.contractAddress = address
                  newTk.tokenID = tokenID
                  newTk.name = tokenName
                  newTk.tokenURI = tokenURI
                  newTk.imageURL = imageURL
                  newTk.owner = to
                  newTk.createdAt = Date.now()
                  await newTk.save()
                }
              }
            } catch (error) {
              console.log('error 9')
            }
          })
        })
        await Promise.all(promise)
      }
      return end
    } else if (tnxs) {
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
              console.log('error 8')
              erc721 = null
            }
            if (!erc721) {
              try {
                let minter = new ERC721CONTRACT()
                minter.address = contractInfo.address
                let contractName = await contractutils.getName(
                  contractInfo.address,
                )
                minter.name = contractName
                console.log(contractName)
                let contractSymbol = await contractutils.getSymbol(
                  contractInfo.address,
                )
                minter.symbol = contractSymbol
                console.log(contractSymbol)
                await minter.save()
                let category = new Category()
                category.minterAddress = contractInfo.address
                category.type = 721
                await category.save()
              } catch (error) {
                // console.log(error)
                // console.log('error 7')
                // console.log(contractInfo.address)
              }
            }
            let sc = contractutils.loadContractFromAddress(contractInfo.address)
            trackedAddresses.push(contractInfo.address)
            trackedContracts.push(sc)
            // console.log(trackedAddresses)
            sc.on('Transfer', async (from, to, tokenID) => {
              console.log(from, to, tokenID)
              try {
                from = toLowerCase(from)
                to = toLowerCase(to)
                tokenID = parseInt(tokenID)
                // if (!tokenURI.startsWith('https://')) return
                let erc721token = await NFTITEM.findOne({
                  contractAddress: contractInfo.address,
                  tokenID: tokenID,
                })

                if (erc721token) {
                  if (to == validatorAddress) {
                    await erc721token.remove()
                  } else {
                    if (erc721token.owner != to) {
                      erc721token.owner = to
                      let now = Date.now()
                      try {
                        if (erc721token.createdAt > now)
                          erc721token.createdAt = now
                      } catch (error) {
                        console.log('error 6')
                      }
                      await erc721token.save()
                    }
                  }
                } else {
                  let tokenURI = await sc.tokenURI(tokenID)
                  let metadata = await axios.get(tokenURI)
                  let tokenName = ''
                  let imageURL = ''
                  try {
                    tokenName = metadata.data.name
                    imageURL = metadata.data.image
                  } catch (error) {
                    console.log('error 5')
                  }
                  if (to == validatorAddress) {
                  } else {
                    let newTk = new NFTITEM()
                    newTk.contractAddress = contractInfo.address
                    newTk.tokenID = tokenID
                    newTk.name = tokenName
                    newTk.tokenURI = tokenURI
                    newTk.imageURL = imageURL
                    newTk.owner = to
                    newTk.createdAt = Date.now()
                    await newTk.save()
                  }
                }
              } catch (error) {
                console.log('error 4')
              }
            })
          }
        }
      })
      await Promise.all(promises)
      let categoryPromise = categories.map(async (category) => {
        let address = category.minterAddress
        let sc = contractutils.loadContractFromAddress(address)
        trackedAddresses.push(address)
        trackedContracts.push(sc)
        // console.log(trackedAddresses)
        sc.on('Transfer', async (from, to, tokenID) => {
          console.log(from, to, tokenID)
          try {
            from = toLowerCase(from)
            to = toLowerCase(to)
            tokenID = parseInt(tokenID)
            // if (!tokenURI.startsWith('https://')) return
            let erc721token = await NFTITEM.findOne({
              contractAddress: address,
              tokenID: tokenID,
            })

            if (erc721token) {
              if (to == validatorAddress) {
                await erc721token.remove()
              } else {
                if (erc721token.owner != to) {
                  erc721token.owner = to
                  let now = Date.now()
                  try {
                    if (erc721token.createdAt > now) erc721token.createdAt = now
                  } catch (error) {
                    console.log('error 1')
                  }
                  await erc721token.save()
                }
              }
            } else {
              let tokenURI = await sc.tokenURI(tokenID)
              let metadata = await axios.get(tokenURI)
              let tokenName = ''
              let imageURL = ''
              try {
                tokenName = metadata.data.name
                imageURL = metadata.data.image
              } catch (error) {
                console.log('error 2')
              }
              if (to == validatorAddress) {
              } else {
                let newTk = new NFTITEM()
                newTk.contractAddress = address
                newTk.tokenID = tokenID
                newTk.name = tokenName
                newTk.tokenURI = tokenURI
                newTk.imageURL = imageURL
                newTk.owner = to
                newTk.createdAt = Date.now()
                await newTk.save()
              }
            }
          } catch (error) {
            console.log(error)
            console.log('error 3')
          }
        })
      })
      await Promise.all(categoryPromise)
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
