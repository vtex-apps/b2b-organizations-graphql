/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppGraphQLClient } from '@vtex/api'

export class SFPGraphQL extends AppGraphQLClient {
  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.storefront-permissions@1.x', ctx, options)
  }

  public query = async (query: string, variables: any, extensions: any) => {
    return this.graphql.query(
      { query, variables, extensions },
      {
        params: {
          locale: this.context.locale,
        },
      }
    )
  }
}
