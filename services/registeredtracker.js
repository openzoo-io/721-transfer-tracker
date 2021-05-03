const mongoose = require('mongoose')

const ERC721CONTRACT = mongoose.model('ERC721CONTRACT')
const ERC1155CONTRACT = mongoose.model('ERC1155CONTRACT')

const collectionTracker = require('./collectiontracker')

let trackList = new Array()

const LS = require('node-localstorage').LocalStorage

const restartTrackForRegisteredCollections = async () => {
  let localstorage = new LS('../storage/trackList')
  localstorage.removeItem('trackList')

  let erc721s = await ERC721CONTRACT.find().select('address')
  let promises721 = erc721s.map(async (erc721) => {
    if (!trackList.includes(erc721)) {
      trackList.push(erc721)
      await collectionTracker.trackCollectionTransfer(erc721)
    }
  })
  await Promise.all(promises721)
  return
}

module.exports = restartTrackForRegisteredCollections
