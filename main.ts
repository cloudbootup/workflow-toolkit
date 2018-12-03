import * as dispatcher from './src/dispatcher';

dispatcher.start(dispatcher.defaultProcessorCount, dispatcher.defaultHandlers);