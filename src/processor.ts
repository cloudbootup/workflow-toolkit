import { DispatcherMessage } from './dispatcher';

// The types of messages we'll be working with
type MessageType = 'done' | 'error' | 'retry' | 'new';

// Every message must have an id and a type
interface Message<S extends MessageType> {
  id: S extends 'new' ? -1 : number
  type: S
}

// Tells the dispatcher we are done
export interface DoneMessage extends Message<'done'> { }

// Tells the dispatcher there was an error
export interface ErrorMessage extends Message<'error'> {
  message: string
}

// This tells the dispatcher we want to retry this work again
export interface RetryMessage extends Message<'retry'> { }

// Tells the dispatcher to add and distribute new work
export interface NewWorkMessage extends Message<'new'> { }

// All the different message types the dispatcher should expect from us
export type ProcessorMessage = DoneMessage | ErrorMessage | RetryMessage | NewWorkMessage;

// This should never happen and is used as the fallback in switch/case
function error(m: never): never {
  throw `Unknown message type: ${(m as DispatcherMessage).type}`;
}

// Process the message and send a response to the dispatcher
function processor(m: DispatcherMessage) {
  try {
    switch (m.type) {
      case 'work': {
        return workMessageHandler(m);
      }
      case 'retry': {
        return retryMessageHandler(m);
      }
      case 'exit': {
        return exitMessageHandler(m);
      }
      default:
        const errorMessage: ErrorMessage = {
          id: (m as DispatcherMessage).id,
          type: 'error',
          message: `Unknown message type ${(m as DispatcherMessage).type}`
        };
        process.send!(errorMessage);
        return error(m); // Should never happen
    }
  } catch (error) {
    console.error('Error when processing message in child process', m, error);
    const errorMessage: ErrorMessage = {
      id: m.id,
      type: 'error',
      message: error
    };
    process.send!(errorMessage);
  }
}

// Receive and process the message from the dispatcher
process.on('message', processor);

// Handle exit messages
function exitMessageHandler(m: import("./dispatcher").ExitMessage) {
  const response: DoneMessage = {
    id: m.id,
    type: 'done'
  };
  process.send!(response);
  return process.exit(0);
}

// Handle retry messages
function retryMessageHandler(m: import("./dispatcher").RetryMessage) {
  const response: DoneMessage = {
    id: m.id,
    type: 'done'
  };
  return process.send!(response);
}

// Handle work messages
function workMessageHandler(m: import("./dispatcher").WorkMessage) {
  const response: DoneMessage = {
    id: m.id,
    type: 'done'
  };
  return process.send!(response);
}
