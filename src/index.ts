// Core HTTP layer
export {
  session_types,
  ClientOptions,
  HttpResponse,
  HttpClient,
  Method,
  BasicCredentials,
  RequestOptions,
  HeaderValue,
  ResponseHeaders,
  BearerFetcher,
  HttpClientResponse,
  RequestMetadata,
  HttpClientOptions,
  HttpClientException,
  isHttpClientException
} from "./AdtHTTP"

// Core exception handling
export {
  AdtException,
  AdtErrorException,
  SAPRC,
  ExceptionProperties,
  isAdtError,
  isCsrfError,
  isHttpError,
  isAdtException,
  isLoginError,
  fromResponse,
  fromError,
  fromException,
  adtException,
  ValidateObjectUrl,
  ValidateStateful,
  validateParseResult,
  isErrorMessageType
} from "./AdtException"

// Main client
export { BWAdtClient, createSSLConfig } from "./BWAdtClient"

// Logging
export { LogCallback, LogData } from "./requestLogger"

// Utilities
export {
  isObject,
  isArray,
  isString,
  isNumber,
  isNativeError,
  isUndefined,
  JSON2AbapXML,
  xmlArrayType,
  extractXmlArray,
  xmlNode,
  xmlFlatArray,
  xmlArray,
  xmlRoot,
  stripNs,
  xmlNodeAttr,
  typedNodeAttr,
  numberParseOptions,
  fullParse,
  parse,
  toInt,
  parseSapDate,
  toSapDate,
  parseJsonDate,
  btoa,
  parts,
  followUrl,
  boolFromAbap,
  formatQS,
  hasMessage,
  toXmlAttributes,
  Clean,
  orUndefined,
  mixed,
  encode as encodeEntity
} from "./utilities"

// Re-export axios client
export { AxiosHttpClient } from "./AxiosHttpClient"
