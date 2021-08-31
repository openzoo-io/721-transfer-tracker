require('dotenv').config()
const ethers = require('ethers')

const SimplifiedERC721ABI = require('../constants/simplifiederc721abi')
const MinimalSC20ABI = require('../constants/mini_contract_abi.js')
const rpcapi = process.env.NETWORK_RPC
const chaindID = parseInt(process.env.NETWORK_CHAINID)
const provider = new ethers.providers.JsonRpcProvider(rpcapi, chaindID)
// symbol store
const symbolStore = new Map()
// name store
const nameStore = new Map()

const toLowerCase = (val) => {
  if (val) return val.toLowerCase()
  else return val
}

const loadContractFromAddress = (address) => {
  try {
    let abi = SimplifiedERC721ABI
    let contract = new ethers.Contract(address, abi, provider)
    return contract
  } catch (error) {}
}

const getTokenInfo = async (address, tkID) => {
  let minter = contractutils.loadContractFromAddress(address)
  if (!minter) return null
  let uri = await minter.tokenURI(tkID)
  return uri
}

const getSymbol = async (address) => {
  address = toLowerCase(address)
  let symbol = symbolStore.get(address)
  if (symbol) return symbol
  let tokenContract = new ethers.Contract(address, MinimalSC20ABI, provider)
  symbol = await tokenContract.symbol()
  symbolStore.set(address, symbol)
  return symbol
}

const getName = async (address) => {
  address = toLowerCase(address)
  let name = nameStore.get(address)
  if (name) return name
  let tokenContract = new ethers.Contract(address, MinimalSC20ABI, provider)
  name = await tokenContract.name()
  nameStore.set(address, name)
  return name
}
const contractutils = {
  loadContractFromAddress,
  getTokenInfo,
  getSymbol,
  getName,
}

module.exports = contractutils
