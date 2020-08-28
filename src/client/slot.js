
import {
  Connection,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'

import {getNodeConnection} from './nodeConnection'


async function main() {

  const connection = await getNodeConnection()

  console.log("-----")

  const nodeVersion = await connection.getVersion()
  console.log( "Node software version is", nodeVersion['solana-core'] )

  const totalSupply = await connection.getTotalSupply()
  console.log( "Cluster total supply is", totalSupply, "lamports, which is", totalSupply/LAMPORTS_PER_SOL, "Sol" )

  const slot = await connection.getSlot()
  console.log( "Cluster current slot is", slot )

  console.log("-----")
}

main()
  .catch(err => {
    console.error(err)
  })
  .then(() => process.exit())
