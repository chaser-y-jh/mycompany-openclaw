import Foundation

public enum MerClawRemindersCommand: String, Codable, Sendable {
    case list = "reminders.list"
    case add = "reminders.add"
}

public enum MerClawReminderStatusFilter: String, Codable, Sendable {
    case incomplete
    case completed
    case all
}

public struct MerClawRemindersListParams: Codable, Sendable, Equatable {
    public var status: MerClawReminderStatusFilter?
    public var limit: Int?

    public init(status: MerClawReminderStatusFilter? = nil, limit: Int? = nil) {
        self.status = status
        self.limit = limit
    }
}

public struct MerClawRemindersAddParams: Codable, Sendable, Equatable {
    public var title: String
    public var dueISO: String?
    public var notes: String?
    public var listId: String?
    public var listName: String?

    public init(
        title: String,
        dueISO: String? = nil,
        notes: String? = nil,
        listId: String? = nil,
        listName: String? = nil)
    {
        self.title = title
        self.dueISO = dueISO
        self.notes = notes
        self.listId = listId
        self.listName = listName
    }
}

public struct MerClawReminderPayload: Codable, Sendable, Equatable {
    public var identifier: String
    public var title: String
    public var dueISO: String?
    public var completed: Bool
    public var listName: String?

    public init(
        identifier: String,
        title: String,
        dueISO: String? = nil,
        completed: Bool,
        listName: String? = nil)
    {
        self.identifier = identifier
        self.title = title
        self.dueISO = dueISO
        self.completed = completed
        self.listName = listName
    }
}

public struct MerClawRemindersListPayload: Codable, Sendable, Equatable {
    public var reminders: [MerClawReminderPayload]

    public init(reminders: [MerClawReminderPayload]) {
        self.reminders = reminders
    }
}

public struct MerClawRemindersAddPayload: Codable, Sendable, Equatable {
    public var reminder: MerClawReminderPayload

    public init(reminder: MerClawReminderPayload) {
        self.reminder = reminder
    }
}
