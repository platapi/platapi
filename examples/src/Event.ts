export interface Event<T = any> {
    /**
     * Datatype of event
     */
    type: string;

    /**
     * Arbitrary data for the event
     */
    data: T;
}
