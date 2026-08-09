export {
  entityDetailQueryOptions,
  FeatureCreatePage,
  FeatureEditPage
} from './pages/detail';
export { entitiesQueryOptions, FeaturePage } from './pages/index';
export {
  createEntityMutation,
  deleteEntityMutation,
  updateEntityMutation
} from './server/FEATURE.mutations';
export { getEntities, getEntityDetail } from './server/FEATURE.queries';
