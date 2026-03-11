// BW-specific API exports

// Core modules
export * from "./abapClass"
export * from "./common"
export * from "./ddic"
export * from "./infoprovider"
export * from "./repository"
export * from "./systemInfo"
export * from "./search"

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
  UpdateADSOOptions
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
  updateADSO,
  createADSO,
  getADSONodePath,
  validateInfoArea,
  validateTemplateADSO,
  validateNewADSOName,
  validateADSOExists,
  validateADSONewName,
  validateADSOCanDelete,
  validateADSOCanActivate
} from "./adso"

export {
  lockTransformation,
  unlockTransformation,
  getTransformation,
  getTransformationDetails,
  getTransformationVersions,
  checkTransformation,
  updateTransformation,
  activateTransformation,
  parseTransformationSettings,
  extractAbapClassName,
  extractRoutineMethodName,
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
