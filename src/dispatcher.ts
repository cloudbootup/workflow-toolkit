import * as subprocess from 'child_process';
import * as path from 'path';
import * as os from 'os';
import * as processor from './processor';
import * as common from './common';

type MessageType = 'work' | 'retry' | 'exit';

// Every message must have an ID so the processor can send a response
interface Message<S extends MessageType, I extends number> extends common.Typed<S> {
  id: I
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

export interface ClientMapping {
  exit: ExitMessage
  retry: RetryMessage
  work: WorkMessage
}

// Now specify all the invariants that the messages must satisfy
{
  // Dispatcher messages must implement all the message types
  common.isTrue<common.Eq<DispatcherMessage["type"], MessageType>>(true);
  // Client mapping must represent every message type
  common.isTrue<common.Eq<keyof ClientMapping, MessageType>>(true);
  // Client mapping keys and types must actually match so we don't accidentally map 'work' to 'done'
  common.isTrue<common.KeyTypeEq<ClientMapping>>(true);
}

// Verify at compile time that we handle all the relevant message types
type ProcessorMessageTypes = processor.ProcessorMessage["type"];
type HandlerMapping<K> = K extends ProcessorMessageTypes ? (m: processor.ClientMapping[K]) => void : never;
type HandlerMap = { [K in ProcessorMessageTypes]: HandlerMapping<K> };

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
async function messageListener(m: processor.ProcessorMessage, handlerMap: HandlerMap) {
  console.log('Received processor message', m);
  // This is a little annoying but we need to duplicate things so that the compiler can help
  switch (m.type) {
    case 'done':
      handlerMap[m.type](m);
      break;
    case 'error':
      handlerMap[m.type](m);
      break;
    case 'retry':
      handlerMap[m.type](m);
      break;
    case 'new':
      handlerMap[m.type](m);
      break;
    default:
      const n: never = m; // Just so the compiler will complain if the type is not never
      throw `This can't happen ${n}`;
  }
}

// Handle processor exit messages
async function processorExit(exitCode?: number, signal?: string) {
  console.log(`Processor finished with exit code = ${exitCode} and signal = ${signal}`);
}

// Create the sub processes and populate the worker map
export async function start(workerCount = defaultProcessorCount, handlerMap: HandlerMap) {
  if (workerCount <= 0) {
    throw `Worker count must be a positive number: ${workerCount}`;
  }
  // Create the workers
  for (let i = 0; i < workerCount; i++) {
    const worker = subprocess.fork(processorModule);
    // Attach the message listeners
    worker.on('message', m => messageListener(m, handlerMap));
    workers[worker.pid] = worker;
  }
}