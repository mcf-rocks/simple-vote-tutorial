
import {
    PublicKey,
} from '@solana/web3.js'

import {Store} from './util/store';

export async function getStore(connection, file) {

  const store = new Store();

  let config

  try {
    config = await store.load(file)
  } catch (err) {

    console.log("No file:",file)
    return { inStore: false }

  }

  let programId

  try {
    programId = new PublicKey(config.programId);
  } catch (err) {

    console.log("No programId in file")
    return { inStore: false }

  }


  let programInfo = await connection.getAccountInfo(programId);

  if ( !programInfo ) {

    console.log("No programId on-chain")
    return { inStore: false }

  }
 
  let accountId 

  try {
    accountId = new PublicKey(config.accountId);
  } catch (err) {

    console.log("No accountId in file")
    return { inStore: false }

  }

  let accountInfo = await connection.getAccountInfo(accountId);
  
  if ( !accountInfo ) {

    console.log("No accountId on-chain")
    return { inStore: false }
  }

  return { inStore: true, programId, accountId }
}

export async function setStore(file, programId, accountId) {

  const store = new Store();

  await store.save(file, {
    programId: programId.toBase58(),
    accountId: accountId.toBase58(),
  })  

}

