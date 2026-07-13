export type ServiceToken<T> = symbol & { readonly __type?: T };

type Factory<T> = (container: ServiceContainer) => T;

interface Registration<T> {
  factory: Factory<T>;
  singleton: boolean;
  instance?: T;
}

export class ServiceContainer {
  private readonly registrations = new Map<symbol, Registration<unknown>>();

  registerSingleton<T>(token: ServiceToken<T>, factory: Factory<T>): void {
    this.registrations.set(token, {
      factory: factory as Factory<unknown>,
      singleton: true,
      instance: undefined,
    });
  }

  registerTransient<T>(token: ServiceToken<T>, factory: Factory<T>): void {
    this.registrations.set(token, {
      factory: factory as Factory<unknown>,
      singleton: false,
      instance: undefined,
    });
  }

  resolve<T>(token: ServiceToken<T>): T {
    const registration = this.registrations.get(token);
    if (!registration) {
      throw new Error("No registration found for requested dependency token.");
    }

    if (!registration.singleton) {
      return registration.factory(this) as T;
    }

    if (registration.instance === undefined) {
      registration.instance = registration.factory(this);
    }

    return registration.instance as T;
  }
}
