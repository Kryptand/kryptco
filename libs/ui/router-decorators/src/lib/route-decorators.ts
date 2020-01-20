import { Observable, OperatorFunction } from 'rxjs';
import { map } from 'rxjs/operators';
import { ActivatedRoute } from '@angular/router';

export interface RouteConfig {
  observable?: boolean;
  pipe?: Array<OperatorFunction<any, any>>;
  inherit?: boolean;
}


function extractRoute(
  parent: ActivatedRoute,
  routeProperty: string,
  inherit = false
): Observable<any> {
  if (inherit) {
    // Move up to the highest level
    while (parent.firstChild) {
      parent = parent.firstChild;
    }
  }

  return parent[routeProperty];
}


function extractValues(
  args: string[],
  stream$: Observable<any>
): Observable<any> {
  return stream$.pipe(
    map(routeValues => {
      const values = args.reduce((data, arg) => {
        if (routeValues && routeValues[arg]) {
          data[arg] = routeValues[arg];
        }

        return data;
      }, {});

      return args.length === 1 ? values[args[0]] : values;
    })
  );
}

function routeDecoratorFactory(
  routeProperty,
  args,
  extractor?
): PropertyDecorator {
  const config = (typeof args[args.length - 1] === 'object'
    ? args.pop()
    : {}) as RouteConfig;

  return (prototype: { ngOnInit(): void }, key: string): void => {
    if (!args.length) {
      args = [key.replace(/\$$/, '')];
    }

    // `ngOnInit` should exist on the component, otherwise the decorator will not work with the AOT compiler!!
    if (!prototype.ngOnInit) {
      throw new Error(
        `${prototype.constructor.name} uses the ${routeProperty} @decorator without implementing 'ngOnInit'`
      );
    }

    const ngOnInit = prototype.ngOnInit;

    prototype.ngOnInit = function(): void {
      if (!this.route) {
        throw new Error(
          `${this.constructor.name} uses a route @decorator without a 'route: ActivatedRoute' property`
        );
      }
      let stream$ = extractor(this.route, routeProperty, config.inherit);
      stream$ = extractValues(args, stream$);
      if (config.pipe) {
        stream$ = stream$.pipe(...config.pipe);
      }
      if (config.observable === false) {
        stream$.subscribe(data => {
          this[key] = data;
        });
      } else {
        this[key] = stream$;
      }
      ngOnInit.call(this);
    };
  };
}

/*
The factory is wrapped in a function for the AOT compiler
 */
export function RouteData(
  ...args: Array<string | RouteConfig>
): PropertyDecorator {
  return routeDecoratorFactory('data', args, extractRoute);
}

export function RouteParams(
  ...args: Array<string | RouteConfig>
): PropertyDecorator {
  return routeDecoratorFactory('params', args, extractRoute);
}

export function RouteQueryParams(
  ...args: Array<string | RouteConfig>
): PropertyDecorator {
  return routeDecoratorFactory('queryParams', args, route => route.queryParams);
}
