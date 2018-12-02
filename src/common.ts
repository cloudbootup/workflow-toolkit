type Keys = string | number | symbol;
type Typeable<S extends Keys> = { [K in S]: Typed<S> };

export type Typed<S extends Keys> = { type: S };
export type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : never) : never;
export type AllTrue<A> = { [K in keyof A]-?: true };
export type KeyTypeEqMapping<A> = A extends Typeable<keyof A> ? { [K in keyof A]-?: Eq<K, A[K]["type"]> } : never;
export type KeyTypeEq<A> = Eq<AllTrue<A>, KeyTypeEqMapping<A>>;