import DomainEvent from './DomainEvent';

export default abstract class EntityDeletedEvent<T> extends DomainEvent<{ OldImage: T }> {
}