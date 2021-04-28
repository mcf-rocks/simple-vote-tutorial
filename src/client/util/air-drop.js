// @flow

import {Account, Connection} from '@solana/web3.js'

import {sleep} from './sleep'

export async function airDrop(
  account: Account,
  connection: Connection,
  lamports: number = 1000000000,   // current max on devnet is 1 Sol, might change in the future, adjust accordingly
): Promise<Account> {

  const initial = await connection.getBalance(account.publicKey)
  const expected = initial + lamports

  let retries = 1
  await connection.requestAirdrop(account.publicKey, lamports)
  for (;;) {
    await sleep(500)
    if (expected === (await connection.getBalance(account.publicKey))) {
      return account
    }
    if (--retries <= 0) {
      break
    }
    console.log('Airdrop retry ' + retries)
  }
  console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
  console.log("This can fail or appear to fail if the faucet is broken or slow");
  console.log("Check your balance 'npm run balance' it may still have worked");
  console.log("+++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++");
  throw new Error(`Airdrop of ${lamports} failed`)

}
