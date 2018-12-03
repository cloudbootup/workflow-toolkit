import * as dispatcher from './dispatcher';
import * as common from './common';

// The types of messages we'll be working with
type MessageType = 'done' | 'error' | 'retry' | 'new';

// Every message must have an id and a type
interface Message<S extends MessageType, I extends number> extends common.Typed<S> {
  id: I
}

// Tells the dispatcher we are done
export interface DoneMessage extends Message<'done', number> { }

// Tells the dispatcher there was an error
export interface ErrorMessage extends Message<'error', number> {
  message: string
}

// This tells the dispatcher we want to retry this work again
export interface RetryMessage extends Message<'retry', number> { }

// Tells the dispatcher to add and distribute new work
export interface NewWorkMessage extends Message<'new', -1> {
  workItems: unknown[]
}

// All the different message types the dispatcher should expect from us
export type ProcessorMessage = DoneMessage | ErrorMessage | RetryMessage | NewWorkMessage;

export interface ClientMapping {
  done: DoneMessage
  error: ErrorMessage
  retry: RetryMessage
  new: NewWorkMessage
}

{
  // Make sure we actually have a message for each type
  common.isTrue<common.Eq<ProcessorMessage["type"], MessageType>>(true);
  // Make sure every message type is represented
  common.isTrue<common.Eq<keyof ClientMapping, MessageType>>(true);
  // Make sure the mapping is correct so we don't accidentally map 'new' to 'done'
  common.isTrue<common.KeyTypeEq<ClientMapping>>(true);
}

type DispatcherMessageTypes = dispatcher.DispatcherMessage["type"];
type HandlerMapping<K> = K extends DispatcherMessageTypes ? (m: dispatcher.ClientMapping[K]) => void : never;
type HandlerMap = { [K in DispatcherMessageTypes]: HandlerMapping<K> };

// This should never happen and is used as the fallback in switch/case
function error(m: never): never {
  throw new Error(`Unknown message type: ${(m as dispatcher.DispatcherMessage).type}`);
}

// Process the message and send a response to the dispatcher
function processor(m: dispatcher.DispatcherMessage, handlerMap: HandlerMap) {
  try {
    switch (m.type) {
      case 'work': {
        return handlerMap[m.type](m);
      }
      case 'retry': {
        return handlerMap[m.type](m);
      }
      case 'exit': {
        return handlerMap[m.type](m);
      }
      default: {
        const n = m as dispatcher.DispatcherMessage;
        const errorMessage: ErrorMessage = {
          id: n.id, type: 'error', message: `Unknown message type ${n.type}`
        };
        process.send!(errorMessage);
        return error(m); // Should never happen so compiler will complain if we don't cover a case
      }
    }
  } catch (error) { // Other errors can also happen so handle those accordingly
    console.error('Error when processing message in child process', m, error);
    const errorMessage: ErrorMessage = {
      id: m.id, type: 'error', message: error
    };
    process.send!(errorMessage);
  }
}

/*
  Modify these functions if you want to do some other kind of work. This is the
  code and configuration for the workers. The dispatcher doesn't do any runtime
  configuration or module loading other than whatever is configured here.
*/

// Handle exit messages
function exitMessageHandler(m: dispatcher.ExitMessage) {
  const response: DoneMessage = {
    id: m.id,
    type: 'done'
  };
  process.send!(response);
  return process.exit(0);
}

// Handle retry messages
function retryMessageHandler(m: dispatcher.RetryMessage) {
  const response: DoneMessage = {
    id: m.id,
    type: 'done'
  };
  return process.send!(response);
}

// Handle work messages
function workMessageHandler(m: dispatcher.WorkMessage) {
  const response: DoneMessage = {
    id: m.id,
    type: 'done'
  };
  return process.send!(response);
}

// Attach all the handlers and make the compiler complain if we don't attach everything properly
const handlerMap: HandlerMap = {
  exit: exitMessageHandler,
  retry: retryMessageHandler,
  work: workMessageHandler
}

// Receive and process the message from the dispatcher
process.on('message', m => processor(m, handlerMap));