// BW-specific API exports

// Core modules
export * from "./abapClass"
export * from "./common"
export * from "./dataflow"
export * from "./datasource"
export * from "./ddic"
export * from "./replication"
export * from "./repository"
export * from "./systemInfo"
export * from "./search"
export * from "./transport"
export * from "./reporting"
// search.ts 通过 export * 已导出 getTransformationsOf / getDTPsOf

// Generic BW Object base class and unified types
export * from "./bwObject"
export * from "./types"

// Module-specific exports (only export functions, types are in types.ts)
export type {
  TemplateType,
  ADSOMetaData,
  ADSOVersion,
  ADSOTables,
  ADSOConfiguration,
  NodePathEntry,
  CreateADSOOptions,
  UpdateADSOOptions,
  ADSOFieldDefinition
} from "./adso"

export type {
  TransformationMetaData,
  TransformationVersion,
  TransformationRoutineStep,
  TransformationRoutineRule,
  TransformationRoutineGroup,
  TransformationSettings,
  GetTransformationOptions,
  UpdateTransformationOptions
} from "./transformation"

export type {
  DTPType,
  DTPStatus,
  DTPMetaData,
  DTPVersion,
  DTPExecutionResult
} from "./dtp"

export type {
  ProcessChainStatus,
  ProcessChainType,
  ProcessChainMetaData,
  ProcessChainVersion,
  ProcessChainExecutionResult,
  ProcessChainLogEntry,
  ProcessChainStatusInfo
} from "./processchain"

export type {
  GetInfoObjectOptions
} from "./infoobject"

export type {
  DataSourceDetails,
  DataSourceField,
  DataSourceVersion,
  ReplicationTask,
  ReplicationResult
} from "./types"

// Export all functions (using wildcard for functions only)
export {
  getDataSource,
  getDataSourceXml,
  getDataSourceDetails,
  getDataSourceVersions,
  getDataSourceFields,
  lockDataSource,
  unlockDataSource,
  updateDataSource,
  activateDataSource,
  mergeDataSourceProposal,
  parseDataSourceDetails,
  parseDataSourceFields,
  parseDataSourceVersions,
  extractDataSourceTimestamp,
  RSDS_CONTENT_TYPE,
  RSDS_ACCEPT,
  RSDS_PROPOSAL_REQUEST_CONTENT_TYPE,
  RSDS_PROPOSAL_RESPONSE_CONTENT_TYPE
} from "./datasource"

export {
  getReplicationInfo,
  replicateDataSource,
  replicateDataSourceFull,
  buildReplicationRequestBody,
  parseReplicationTasks,
  parseReplicationResult
} from "./replication"

// Export all functions (using wildcard for functions only)
export {
  lockADSO,
  unlockADSO,
  activateADSO,
  checkADSO,
  getADSO,
  getADSODetails,
  getADSOVersions,
  getADSOConfiguration,
  getADSOTables,
  getADSOXml,
  updateADSO,
  createADSO,
  getADSONodePath,
  validateInfoArea,
  validateTemplateADSO,
  validateNewADSOName,
  validateADSOExists,
  validateADSONewName,
  validateADSOCanDelete,
  validateADSOCanActivate,
  buildADSOFieldElementXml,
  addADSOFieldToXml,
  removeADSOFieldFromXml,
  extractADSOTimestamp
} from "./adso"

export {
  lockTransformation,
  unlockTransformation,
  getTransformation,
  getTransformationXml,
  getTransformationDetails,
  getTransformationVersions,
  checkTransformation,
  updateTransformation,
  activateTransformation,
  parseTransformationSettings,
  extractAbapClassName,
  extractRoutineMethodName,
  extractTransformationTimestamp,
  addFieldToEndRoutine,
  removeFieldFromEndRoutine,
  isEndRoutineFieldSelected,
  addTransformationRule,
  autoMapTransformationFields,
  switchTransformationRuntime,
  hasStartRoutine,
  hasEndRoutine,
  hasExpertRoutine,
  validateTransformationExists,
  validateTransformationNewName,
  validateTransformationCanDelete,
  validateTransformationCanActivate
} from "./transformation"

export {
  lockDTP,
  unlockDTP,
  getDTP,
  getDTPDetails,
  getDTPVersions,
  activateDTP,
  checkDTP,
  executeDTP,
  validateDTPExists,
  validateDTPNewName,
  validateDTPCanDelete,
  validateDTPCanActivate
} from "./dtp"

export {
  lockProcessChain,
  unlockProcessChain,
  getProcessChain,
  getProcessChainDetails,
  getProcessChainVersions,
  activateProcessChain,
  checkProcessChain,
  executeProcessChain,
  stopProcessChain,
  getProcessChainLogs,
  getProcessChainStatus,
  validateProcessChainExists,
  validateProcessChainNewName,
  validateProcessChainCanDelete,
  validateProcessChainCanActivate
} from "./processchain"

export {
  getInfoObject,
  getInfoObjectMetadata,
  validateInfoObjectExists,
  validateInfoObjectNewName,
  validateInfoObjectCanDelete,
  validateInfoObjectCanActivate
} from "./infoobject"
