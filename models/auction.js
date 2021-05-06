const mongoose = require('mongoose')

const Auction = mongoose.Schema({
  minter: { type: String, required: true },
  tokenID: { type: Number, required: true },
  startTime: { type: Number, default: Date.now },
  endTime: { type: Date, default: new Date(2999, 1, 1) },
})

mongoose.model('Auction', Auction)
