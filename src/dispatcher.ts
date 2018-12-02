import * as subprocess from 'child_process';
import * as path from 'path';
import { ProcessorMessage } from './processor';

type MessageType = 'work' | 'retry' | 'exit';

// Every message must have an ID so the processor can send a response
interface Message<S extends MessageType> {
  id: S extends 'exit' ? -1 : number
  type: S
}

// Ask the processor to do some work
export interface WorkMessage extends Message<'work'> {
  work: number
}

// Ask the processor to retry some work
export interface RetryMessage extends Message<'retry'> {
  retryCounter: number
  work: number
}

// Ask the processor to exit
export interface ExitMessage extends Message<'exit'> {
}

// All the dispatcher message types that processors must handle
export type DispatcherMessage = WorkMessage | RetryMessage | ExitMessage

// The module that will be forked for processing work items
const processorModule = path.join(__dirname, 'processor');

// Send a message to the processors
async function dispatch(w: DispatcherMessage) {
  const processor = subprocess.fork(processorModule);
  // Attach the response handler
  processor.on('message', messageListener);
  for (let i = 0; i < 2; i++) {
    processor.send(w, error => {
      if (error) {
        console.error('Something went wrong when trying to send work for processing', w);
      }
    });
  }
  const exitMessage: ExitMessage = { id: -1, type: 'exit' };
  processor.send(exitMessage);
  processor.once('exit', processorExit);
}

// The processors can send messages back to us and we need to handle them
async function messageListener(m: ProcessorMessage) {
  console.log('Received processor message', m);
  switch (m.type) {
    case 'done':
      break;
    case 'error':
      break;
    case 'retry':
      break;
    case 'new':
      break;
    default:
      throw `This can't happen ${m}`;
  }
}

// Handle processor exit messages
async function processorExit(exitCode?: number, signal?: string) {
  console.log(`Processor finished with exit code = ${exitCode} and signal = ${signal}`);
}

async function main() {
  // Start doing some work
  for (let i = 0; i < 10; i++) {
    dispatch({id: i, work: i, type: 'work'});
  }
}

// Start the dispatcher loop
main();