const ethers = require('ethers')

const test = async () => {
  let provider = new ethers.providers.JsonRpcProvider(
    'https://rpcapi.fantom.network',
    250,
  )

  let tnxCount = await provider.getTransactionCount(
    '0x76b03166c8ab1462b046d7745c77eaa83e656a8c',
  )

  console.log(tnxCount)
}

test()
