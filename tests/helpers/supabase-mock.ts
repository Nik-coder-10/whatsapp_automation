/**
 * Minimal in-memory Supabase stand-in for API-route tests.
 *
 * Mirrors just enough of the postgrest-js surface (from/select/eq/in/
 * neq/order/limit/range/update/maybeSingle/single/rpc) that route
 * handlers run unmodified against scripted table data. Each test
 * supplies a responder; the responder sees the accumulated operation.
 */

export interface MockFilter {
  col: string;
  op: "eq" | "neq" | "in";
  val: unknown;
}

export interface MockOp {
  table: string | null;
  rpc: string | null;
  rpcArgs: unknown;
  filters: MockFilter[];
  single: boolean;
  updateValues: unknown;
}

export interface DbError {
  message: string;
  code?: string;
}

export interface MockResult {
  rows: unknown[];
  error: DbError | null;
  count?: number;
}

export type MockResponder = (op: MockOp) => MockResult;

export interface MockQueryResult {
  data: unknown;
  error: unknown;
  count?: number;
}

export interface MockBuilder {
  select(cols?: string, opts?: unknown): MockBuilder;
  eq(col: string, val: unknown): MockBuilder;
  neq(col: string, val: unknown): MockBuilder;
  in(col: string, val: unknown): MockBuilder;
  order(col: string, opts?: unknown): MockBuilder;
  limit(n: number): MockBuilder;
  range(from: number, to: number): MockBuilder;
  update(values: unknown): MockBuilder;
  maybeSingle(): MockBuilder;
  single(): MockBuilder;
  then(
    resolve: (v: MockQueryResult) => void,
    reject?: (e: unknown) => void,
  ): Promise<void>;
}

interface BuilderState {
  filters: MockFilter[];
  single: boolean;
  updateValues: unknown;
}

function run(
  responder: MockResponder,
  table: string,
  state: BuilderState,
): Promise<MockQueryResult> {
  const result = responder({
    table,
    rpc: null,
    rpcArgs: undefined,
    filters: state.filters,
    single: state.single,
    updateValues: state.updateValues,
  });
  const data = state.single ? (result.rows[0] ?? null) : result.rows;
  return Promise.resolve({ data, error: result.error, count: result.count });
}

function builder(
  responder: MockResponder,
  table: string,
  state: BuilderState,
): MockBuilder {
  const next = (patch: Partial<BuilderState>): MockBuilder =>
    builder(responder, table, {
      filters: [...state.filters],
      single: state.single,
      updateValues: state.updateValues,
      ...patch,
    });
  const b: MockBuilder = {
    select: () => next({}),
    eq: (col, val) => next({ filters: [...state.filters, { col, op: "eq", val }] }),
    neq: (col, val) =>
      next({ filters: [...state.filters, { col, op: "neq", val }] }),
    in: (col, val) =>
      next({ filters: [...state.filters, { col, op: "in", val }] }),
    order: () => next({}),
    limit: () => next({}),
    range: () => next({}),
    update: (values) => next({ updateValues: values }),
    maybeSingle: () => next({ single: true }),
    single: () => next({ single: true }),
    then: (resolve, reject) => run(responder, table, state).then(resolve, reject),
  };
  return b;
}

function fresh(): BuilderState {
  return { filters: [], single: false, updateValues: undefined };
}

export interface MockClient {
  from(table: string): MockBuilder;
  rpc(
    name: string,
    args: unknown,
  ): Promise<{ data: unknown; error: unknown }>;
}

export function createMockClient(responder: MockResponder): MockClient {
  return {
    from: (table: string) => builder(responder, table, fresh()),
    rpc: (name: string, args: unknown) => {
      const r = responder({
        table: null,
        rpc: name,
        rpcArgs: args,
        filters: [],
        single: false,
        updateValues: undefined,
      });
      return Promise.resolve({ data: r.rows, error: r.error });
    },
  };
}
