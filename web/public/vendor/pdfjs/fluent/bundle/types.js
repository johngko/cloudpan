/**
 * The `FluentType` class is the base of Fluent's type system.
 *
 * Fluent types wrap JavaScript values and store additional configuration for
 * them, which can then be used in the `toString` method together with a proper
 * `Intl` formatter.
 */
export class FluentType {
    /**
     * Create a `FluentType` instance.
     *
     * @param value The JavaScript value to wrap.
     */
    constructor(value) {
        this.value = value;
    }
    /**
     * Unwrap the raw value stored by this `FluentType`.
     */
    valueOf() {
        return this.value;
    }
}
/**
 * A {@link FluentType} representing no correct value.
 */
export class FluentNone extends FluentType {
    /**
     * Create an instance of `FluentNone` with an optional fallback value.
     * @param value The fallback value of this `FluentNone`.
     */
    constructor(value = "???") {
        super(value);
    }
    /**
     * Format this `FluentNone` to the fallback string.
     */
    toString(scope) {
        return `{${this.value}}`;
    }
}
/**
 * A {@link FluentType} representing a number.
 *
 * A `FluentNumber` instance stores the number value of the number it
 * represents. It may also store an option bag of options which will be passed
 * to `Intl.NumerFormat` when the `FluentNumber` is formatted to a string.
 */
export class FluentNumber extends FluentType {
    /**
     * Create an instance of `FluentNumber` with options to the
     * `Intl.NumberFormat` constructor.
     *
     * @param value The number value of this `FluentNumber`.
     * @param opts Options which will be passed to `Intl.NumberFormat`.
     */
    constructor(value, opts = {}) {
        super(value);
        this.opts = opts;
    }
    /**
     * Format this `FluentNumber` to a string.
     */
    toString(scope) {
        if (scope) {
            try {
                const nf = scope.memoizeIntlObject(Intl.NumberFormat, this.opts);
                return nf.format(this.value);
            }
            catch (err) {
                scope.reportError(err);
            }
        }
        return this.value.toString(10);
    }
}
/**
 * A {@link FluentType} representing a date and time.
 *
 * A `FluentDateTime` instance stores a Date object, Temporal object, or a number
 * as a numerical timestamp in milliseconds. It may also store an
 * option bag of options which will be passed to `Intl.DateTimeFormat` when the
 * `FluentDateTime` is formatted to a string.
 */
export class FluentDateTime extends FluentType {
    static supportsValue(value) {
        if (typeof value === "number")
            return true;
        if (value instanceof Date)
            return true;
        if (value instanceof FluentType)
            return FluentDateTime.supportsValue(value.valueOf());
        // Temporary workaround to support environments without Temporal
        if ("Temporal" in globalThis) {
            // for TypeScript, which doesn't know about Temporal yet
            const _Temporal = globalThis.Temporal;
            if (value instanceof _Temporal.Instant ||
                value instanceof _Temporal.PlainDateTime ||
                value instanceof _Temporal.PlainDate ||
                value instanceof _Temporal.PlainMonthDay ||
                value instanceof _Temporal.PlainTime ||
                value instanceof _Temporal.PlainYearMonth) {
                return true;
            }
        }
        return false;
    }
    /**
     * Create an instance of `FluentDateTime` with options to the
     * `Intl.DateTimeFormat` constructor.
     *
     * @param value The number value of this `FluentDateTime`, in milliseconds.
     * @param opts Options which will be passed to `Intl.DateTimeFormat`.
     */
    constructor(value, opts = {}) {
        // unwrap any FluentType value, but only retain the opts from FluentDateTime
        if (value instanceof FluentDateTime) {
            opts = { ...value.opts, ...opts };
            value = value.value;
        }
        else if (value instanceof FluentType) {
            value = value.valueOf();
        }
        // Intl.DateTimeFormat defaults to gregorian calendar, but Temporal defaults to iso8601
        if (typeof value === "object" &&
            "calendarId" in value &&
            opts.calendar === undefined) {
            opts = { ...opts, calendar: value.calendarId };
        }
        super(value);
        this.opts = opts;
    }
    [Symbol.toPrimitive](hint) {
        return hint === "string" ? this.toString() : this.toNumber();
    }
    /**
     * Convert this `FluentDateTime` to a number.
     * Note that this isn't always possible due to the nature of Temporal objects.
     * In such cases, a TypeError will be thrown.
     */
    toNumber() {
        const value = this.value;
        if (typeof value === "number")
            return value;
        if (value instanceof Date)
            return value.getTime();
        if ("epochMilliseconds" in value) {
            return value.epochMilliseconds;
        }
        if ("toZonedDateTime" in value) {
            return value.toZonedDateTime("UTC").epochMilliseconds;
        }
        throw new TypeError("Unwrapping a non-number value as a number");
    }
    /**
     * Format this `FluentDateTime` to a string.
     */
    toString(scope) {
        if (scope) {
            try {
                const dtf = scope.memoizeIntlObject(Intl.DateTimeFormat, this.opts);
                return dtf.format(this.value);
            }
            catch (err) {
                scope.reportError(err);
            }
        }
        if (typeof this.value === "number" || this.value instanceof Date) {
            return new Date(this.value).toISOString();
        }
        return this.value.toString();
    }
}
