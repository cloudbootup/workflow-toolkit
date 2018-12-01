import { DispatcherMessage } from './dispatcher';

interface Message {
  id: number
}

export interface DoneMessage extends Message {
  type: 'done'
}

export interface ErrorMessage extends Message {
  type: 'error'
  message: string
}

export interface RetryMessage extends Message {
  type: 'retry'
}

export type ProcessorMessage = DoneMessage | ErrorMessage | RetryMessage;

function error(m: never): never {
  throw `Unknown message type: ${(m as DispatcherMessage).type}`;
}

// Process the message and then send back a proper response
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
process.on('message', (m: DispatcherMessage) => processor(m));

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
