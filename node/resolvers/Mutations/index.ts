import { getAppId } from '../config'
import CostCenters from './CostCenters'
import Organizations from './Organizations'
import Users from './Users'
import Settings from './Settings'


const Index = {
  ...CostCenters,
  ...Organizations,
  ...Users,
  ...Settings,
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
