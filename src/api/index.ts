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
export * from "./dumps"
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
  UpdateTransformationOptions,
  TransformationRuleSpec,
  AddRuleOptions,
  CreateTransformationOptions,
  CreateTransformationResult
} from "./transformation"

export type {
  DTPType,
  DTPStatus,
  DTPMetaData,
  DTPVersion,
  DTPExecutionResult,
  DTPExecuteRunResult,
  CreateDTPOptions
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
  saveAndActivateDataSource,
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
  templateValidationObjectType,
  validateNewADSOName,
  validateADSOExists,
  validateADSONewName,
  buildADSOFieldElementXml,
  buildADSOInfoObjectElementXml,
  addADSOFieldToXml,
  addADSOKeyToXml,
  addADSOKey,
  removeADSOFieldFromXml,
  extractADSOTimestamp,
  normalizeUnitCurrencyElement,
  saveAndActivateADSO,
  createADSOFull
} from "./adso"

export {
  HCPR_CONTENT_TYPE,
  lockHCPR,
  unlockHCPR,
  activateHCPR,
  checkHCPR,
  getHCPRVersions,
  validateHCPRExists,
  getHCPRXml,
  getHCPRDetails,
  parseHCPRDetails,
  extractHCPRTimestamp,
  updateHCPR,
  saveAndActivateHCPR
} from "./hcpr"

export type {
  HCPRDetails,
  HCPRVersion,
  UpdateHCPROptions,
  SaveAndActivateHCPROptions,
  SaveAndActivateHCPRResult
} from "./hcpr"

export {
  lockTransformation,
  unlockTransformation,
  createTransformation,
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
  ensureEndRoutineInXml,
  ensureStartRoutineInXml,
  ensureEndRoutine,
  ensureStartRoutine,
  deriveRoutineClassName,
  hasEndRoutineInXml,
  hasStartRoutineInXml,
  addTransformationRule,
  addPairedAmountCurrencyRule,
  addRule,
  autoMapTransformationFields,
  switchTransformationRuntime,
  hasStartRoutine,
  hasEndRoutine,
  hasExpertRoutine,
  validateTransformationExists,
  validateTransformationNewName,
  saveAndActivateTransformation
} from "./transformation"

export {
  lockDTP,
  unlockDTP,
  createDTP,
  executeDTP,
  getDTPExecuteRunResult,
  getDTP,
  getDTPXml,
  getDTPDetails,
  getDTPVersions,
  activateDTP,
  checkDTP,
  validateDTPExists,
  updateDTP,
  saveAndActivateDTP
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
  getProcessChainStatus,} from "./processchain"

export {
  getInfoObject,
  getInfoObjectMetadata,
  getInfoObjectXml,
  getInfoObjectVersions,
  checkInfoObject,
  validateInfoObjectExists,
  validateInfoObjectNewName,
  buildInfoObjectXml,
  buildInfoObjectUnitXml,
  lockInfoObject,
  unlockInfoObject,
  activateInfoObject,
  updateInfoObject,
  saveAndActivateInfoObject,
  extractInfoObjectTimestamp,
  IOBJ_CONTENT_TYPE,
  createInfoObject,
  createInfoObjectFull,
  createInfoObjectUnit,
  createInfoObjectUnitFull
} from "./infoobject"

export type {
  InfoObjectCreateOptions,
  InfoObjectCreateResult,
  InfoObjectCreateVerification,
  InfoObjectKeyfigureType,
  InfoObjectKfDataType,
  InfoObjectAggregationType,
  InfoObjectUnitCreateOptions,
  InfoObjectUnitCreateResult,
  InfoObjectUnitCreateVerification,
  UpdateInfoObjectOptions,
  SaveAndActivateInfoObjectOptions
} from "./infoobject"
