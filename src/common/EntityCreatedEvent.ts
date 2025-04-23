import DomainEvent from './DomainEvent';

export default abstract class EntityCreatedEvent<T extends object> extends DomainEvent<{ NewImage: T }> {
}