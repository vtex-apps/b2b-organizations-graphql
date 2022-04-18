import { getAppId } from '../config'
import CostCenters from './CostCenters'
import Organizations from './Organizations'
import Users from './Users'

const Index = {
  ...CostCenters,
  ...Organizations,
  ...Users,
  saveAppSettings: async (_: any, __: any, ctx: Context) => {
    const {
      clients: { apps },
    } = ctx

    const app: string = getAppId()

    const newSettings = {}

    try {
      await apps.saveAppSettings(app, newSettings)

      return { status: 'success', message: '' }
    } catch (e) {
      return { status: 'error', message: e }
    }
  },
}

export default Index
