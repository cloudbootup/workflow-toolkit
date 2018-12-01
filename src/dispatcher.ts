import * as subprocess from 'child_process';
import * as path from 'path';
import { ProcessorMessage } from './processor';

// Every message must have an ID so the processor can send a response
interface Message {
  id: number
}

export interface WorkMessage extends Message {
  type: 'work'
  work: number
  extra?: number
}

export interface RetryMessage extends Message {
  type: 'retry'
  work: number
  extra?: number
}

export interface ExitMessage extends Message {
  type: 'exit';
};

export type DispatcherMessage = WorkMessage | RetryMessage | ExitMessage

// The module that will be forked for processing work items
const processorModule = path.join(__dirname, 'processor');

async function dispatch(w: DispatcherMessage) {
  const processor = subprocess.fork(processorModule);
  // Attach the response handler
  processor.on('message', m => messageListener(m));
  for (let i = 0; i < 2; i++) {
    (w as WorkMessage).extra = i;
    processor.send(w, error => {
      if (error) {
        console.error('Something went wrong when trying to send work for processing', w);
      }
    });
  }
  const exitMessage: ExitMessage = { id: -1, type: 'exit' };
  processor.send(exitMessage);
  processor.once('exit', (exitCode, signal) => {
    console.log(`Processor finished with exit code = ${exitCode} and signal = ${signal}`);
  });
}

async function messageListener(m: ProcessorMessage) {
  console.log('Received processor message', m);
}

async function main() {
  // Start doing some work
  for (let i = 0; i < 10; i++) {
    dispatch({id: i, work: i, type: 'work'});
  }
}

// Start the dispatcher loop
main();