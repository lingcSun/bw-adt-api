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

// Domain facades (preferred Public entry)
export {
  AdsoDomain,
  InfoProviderDomain,
  TrfnDomain,
  DtpDomain,
  DataSourceDomain,
  ProcessChainDomain,
  InfoObjectDomain,
  RepositoryDomain,
  QueryDomain,
  SystemDomain,
  DdicDomain,
  TransportDomain,
  InfoAreaDomain
} from "./domains"

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
export { AxiosHttpClient, responseBody } from "./AxiosHttpClient"

// Full REST API surface (domain functions + create/transient flows).
// 2026-09-19 复测 F5：此前 api 层只能从 build/api/* 子路径导入；
// 根入口现在整体再导出 ./api（含 createTransformation / createDTP /
// createBWObject / BWObjectType 等）。transport 相关名称经由 ./api 的
// 再导出提供，不再单独从 ./api/transport 重复导出。
export * from "./api"
