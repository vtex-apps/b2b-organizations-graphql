/* eslint-disable @typescript-eslint/no-explicit-any */
import type { InstanceOptions, IOContext } from '@vtex/api'
import { AppClient, GraphQLClient } from '@vtex/api'

export class GraphQLServer extends AppClient {
  protected graphql: GraphQLClient

  constructor(ctx: IOContext, options?: InstanceOptions) {
    super('vtex.graphql-server@1.x', ctx, options)
    this.graphql = new GraphQLClient(this.http)
  }

  public query = async (query: string, variables: any, extensions: any) => {
    return this.graphql.query(
      { query, variables, extensions },
      {
        params: {
          locale: this.context.locale,
        },
        headers: {
          ...(this.context.sessionToken && {
            sessionToken: this.context.sessionToken,
          }),
        },
        url: `/graphql`,
      }
    )
  }

  public mutation = async (mutate: string, variables: any) => {
    return this.graphql.mutate(
      { mutate, variables },
      {
        params: {
          locale: this.context.locale,
        },
        headers: {
          ...(this.context.sessionToken && {
            sessionToken: this.context.sessionToken,
          }),
        },
        url: `/graphql`,
      }
    )
  }
}
