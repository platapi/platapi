# PlatAPI

The easiest way to create an API to ❤️ — the successor to [apilove](https://www.npmjs.com/package/apilove).

## Installing

`npm i platapi`

You may also install `ts-node` or `ts-node-dev` to make local development easier.

---

## Getting Started (TypeScript)

First create a file in the root of your project called `server.ts`, then add the following lines:

```typescript
import { PlatAPI } from "platapi";

exports.handler = new PlatAPI().handler;
```

That's all you need to do to create an API that runs as either a stand-alone server or a serverless Lambda function.
PlatAPI will automatically determine what environment it's running in and set itself up properly to handler API
requests.

To run your API service locally all you need to do is run `ts-node server.ts`, or if you want to get really fancy you
can use `ts-node-dev --watch ./api,./src --transpile-only server.ts` to run your server and automatically
restart it when it detects changes.

---

## Building your API Code

### Routes

PlatAPI uses route handling logic similar to Next.js in order to define your API routes. By default, PlatAPI
looks for source files in the `./api` directory. The following are some examples of how this works:

`./api/admin/index.ts` or `./api/admin.ts` would be available at `https://myapi.com/admin`

`./api/orders/newest/index.ts` or `./api/orders/newest.ts` would be available at `https://myapi.com/orders/newest`

You can also use route parameters like:

`./api/orders/[orderID]/index.ts` or `./api/orders/[orderID].ts` would be available
at `https://myapi.com/orders/1828972`

### Code

To write the code to handle your API requests, you simply export a default class.
Here is a simple example:

```typescript
//  From ./api/orders/[orderID]/index.ts
import { Path, Query, Optional } from "platapi";

export default class OrderAPI {
    static async getOrderByID(
        @Path // This means the variable named orderID will be pulled from the path of the route
        orderID: string,
        @Query // This means the variable named verbose will be pulled from a query parameter
        @Optional // By default, all variables are required and will return an error if not specified. This denotes that this variable is optional.
        verbose?: boolean
    ) {
        return MyOrderSystem.getOrderByID(orderID, verbose);
    }
}
```

---

More documentation coming soon...
