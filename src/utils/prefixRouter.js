class PrefixRouter {
    constructor() {
        this.routes    = new Map();
        this.moduleMap = {};
    }

    on(triggers, moduleKey, handler) {
        for (const t of [].concat(triggers)) {
            this.routes.set(t, handler);
            if (moduleKey) (this.moduleMap[moduleKey] ??= []).push(t);
        }
        return this;
    }

    exec(cmd, args, message, run) {
        const handler = this.routes.get(cmd);
        return handler ? handler(args, message, run) : null;
    }
}

module.exports = PrefixRouter;
