import * as subprocess from 'child_process';
import * as path from 'path';
import * as os from 'os';
import { ProcessorMessage } from './processor';

type MessageType = 'work' | 'retry' | 'exit';

// Every message must have an ID so the processor can send a response
interface Message<S extends MessageType, I extends number> {
  id: I
  type: S
}

// Ask the processor to do some work
export interface WorkMessage extends Message<'work', number> {
  work: number
}

// Ask the processor to retry some work
export interface RetryMessage extends Message<'retry', number> {
  retryCounter: number
  work: number
}

// Ask the processor to exit
export interface ExitMessage extends Message<'exit', -1> { }

// All the dispatcher message types that processors must handle
export type DispatcherMessage = WorkMessage | RetryMessage | ExitMessage

// Default number of workers to spawn if we are not given one
const defaultProcessorCount = os.cpus().length - 1;

// Map the process ID to the subprocess object
type WorkerMap = { [index: number]: subprocess.ChildProcess };

// Where we will keep the workers indexed by their process ID
const workers: WorkerMap = {};

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

// Create the sub processes and populate the worker map
export async function start(workerCount = defaultProcessorCount) {
  if (workerCount <= 0) {
    throw `Worker count must be a positive number: ${workerCount}`;
  }
  // Create the workers
  for (let i = 0; i < workerCount; i++) {
    const worker = subprocess.fork(processorModule);
    workers[worker.pid] = worker;
  }
}