require('dotenv').config()
const axios = require('axios')
const contractutils = require('./contract.utils')

const apiEndPoint = process.env.API_ENDPOINT

const callAPI = async (endpoint, data) => {
  console.log(data)
  await axios({
    method: 'post',
    url: apiEndPoint + endpoint,
    data,
  })
}

const trackedAddresses = []
const trackedContracts = []

const trackerc721 = async () => {
  try {
    let response = await axios.get(`${apiEndPoint}getTrackable721Contracts`)
    if (response) {
      let data = response.data
      if (data.status == 'success') {
        data = data.data
        data.map((address) => {
          if (!trackedAddresses.includes(address)) {
            let sc = contractutils.loadContractFromAddress(address)
            trackedAddresses.push(address)
            trackedContracts.push(sc)
            sc.on('Transfer', async (from, to, tokenID) => {
              tokenID = parseInt(tokenID.toString())
              callAPI('handle721Transfer', { address, to, tokenID })
            })
          }
        })
      }
    }
  } catch (error) {
    console.log(error)
  }
}
const trackAll721s = async () => {
  const func = async () => {
    try {
      await trackerc721()
      setTimeout(async () => {
        await func()
      }, 1000 * 60 * 10)
    } catch (error) {}
  }
  await func()
}

module.exports = trackAll721s
