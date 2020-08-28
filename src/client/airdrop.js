
import {
  LAMPORTS_PER_SOL,
} from '@solana/web3.js'
import fs from 'mz/fs'

import {getOurAccount} from './ourAccount'
import {getNodeConnection} from './nodeConnection'

import {airDrop} from './util/air-drop'


async function main() {

  const ourAccount = await getOurAccount();

  const connection = await getNodeConnection();

  console.log("-----")

  await airDrop(ourAccount, connection)

  let bal = await connection.getBalance( ourAccount.publicKey )

  console.log( "Balance of", ourAccount.publicKey.toString(), "is", bal, "(", bal/LAMPORTS_PER_SOL, ")" )

  console.log("-----")
}

main()
  .catch(err => {
    console.error(err)
  })
  .then(() => process.exit())
