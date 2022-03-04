(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant DEPLOYED_AT block-height)

(define-constant ERR_NOT_AUTHORIZED (err u5001))
(define-constant ERR_EMPTY_LIST (err u5002))
(define-constant ERR_INCORRECT_THRESHOLD (err u5003))
(define-constant ERR_DUPLICATE_OWNER (err u5004))
(define-constant ERR_ALREADY_SETUP (err u5005))
(define-constant ERR_NOT_SETUP (err u5006))
(define-constant ERR_NOT_FOUND (err u5007))
(define-constant ERR_CANT_ABANDON (err u5008))
(define-constant ERR_UNKNOWN_TASK (err u5009))
(define-constant ERR_ALREADY_APPROVED (err u5010))
(define-constant ERR_NOT_APPROVED (err u5011))
(define-constant ERR_ALREADY_EXECUTED (err u5012))


(define-map SafeOwners principal bool)
(define-data-var cfgThreshold uint u0)
(define-data-var cfgOwnersCount uint u0)

(define-read-only (is-owner (who principal))
  (default-to false (map-get? SafeOwners who))
)

(define-read-only (get-threshold)
  (var-get cfgThreshold)
)

(define-read-only (get-owners-count)
  (var-get cfgOwnersCount)
)

(define-public (setup (owners (list 30 principal)) (threshold uint))
  (begin
    (asserts! (is-eq contract-caller CONTRACT_OWNER) ERR_NOT_AUTHORIZED)
    (asserts! (> (len owners) u0) ERR_EMPTY_LIST)
    (asserts! (and (> threshold u0) (<= threshold (len owners))) ERR_INCORRECT_THRESHOLD)
    (asserts! (is-eq (var-get cfgOwnersCount) u0) ERR_ALREADY_SETUP)

    (try! (fold new-owner-clojure owners (ok true)))
    (var-set cfgThreshold threshold)
    (var-set cfgOwnersCount (len owners))
    (ok true)
  )
)

(define-public (add-owners (owners (list 30 principal)))
  (begin
    (asserts! (> (var-get cfgOwnersCount) u0) ERR_NOT_SETUP)
    (asserts! (can-call contract-caller "add-owners") ERR_NOT_AUTHORIZED)
    (asserts! (> (len owners) u0) ERR_EMPTY_LIST)

    (try! (fold new-owner-clojure owners (ok true)))
    (var-set cfgOwnersCount (+ (var-get cfgOwnersCount) (len owners)))
    (ok true)
  )
)

(define-public (remove-owners (owners (list 30 principal)))
  (begin
    (asserts! (> (var-get cfgOwnersCount) u0) ERR_NOT_SETUP)
    (asserts! (can-call contract-caller "remove-owners") ERR_NOT_AUTHORIZED)
    (asserts! (> (len owners) u0) ERR_EMPTY_LIST)
    (asserts! (> (var-get cfgOwnersCount) (len owners)) ERR_CANT_ABANDON)

    (try! (fold remove-owner-clojure owners (ok true)))
    (var-set cfgOwnersCount (- (var-get cfgOwnersCount) (len owners)))
    (and (> (var-get cfgThreshold) (var-get cfgOwnersCount)) (var-set cfgThreshold (var-get cfgOwnersCount)))
    (ok true)
  )
)

(define-public (change-threshold (threshold uint))
  (begin
    (asserts! (> (var-get cfgOwnersCount) u0) ERR_NOT_SETUP)
    (asserts! (and (> threshold u0) (<= threshold (var-get cfgOwnersCount))) ERR_INCORRECT_THRESHOLD)
    (var-set cfgThreshold threshold)
    (ok true)
  )
)

(define-private (new-owner-clojure (who principal) (out (response bool uint)))
  (match out
    okValue (ok (asserts! (map-insert SafeOwners who true) ERR_DUPLICATE_OWNER))
    errValue out
  )
)

(define-private (remove-owner-clojure (who principal) (out (response bool uint)))
  (match out
    okValue (ok (asserts! (map-delete SafeOwners who) ERR_NOT_FOUND))
    errValue out
  )
)

(define-data-var lastTaskId uint u0)
(define-map Tasks
  uint ;; taskId
  {
    threshold: uint,
    approvals: uint,
    executed: bool,
    executor: principal,
  }
)

(define-map Approvals
  {taskId: uint, who: principal}
  bool
)

(define-read-only (has-not-approved (taskId uint) (who principal))
  (is-none (map-get? Approvals {taskId: taskId, who: who}))
)

(define-read-only (get-task (id uint))
  (map-get? Tasks id)
)

(define-read-only (get-last-task-id)
  (var-get lastTaskId)
)

(define-public (create-task)
  (let
    ((newTaskId (+ (var-get lastTaskId) u1)))
    (asserts! (> (var-get cfgOwnersCount) u0) ERR_NOT_SETUP)
    (asserts! (is-owner tx-sender) ERR_NOT_AUTHORIZED)

    (map-insert Tasks newTaskId {
      threshold: (var-get cfgThreshold),
      approvals: u0,
      executed: false,
      executor: contract-caller,
    })

    (var-set lastTaskId newTaskId)
    (ok newTaskId)
  )
)

;; #[allow(unchecked_data)]
(define-public (approve-task (id uint))
  (let
    ((task (unwrap! (get-task id) ERR_UNKNOWN_TASK)))
    (asserts! (is-owner tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (has-not-approved id tx-sender) ERR_ALREADY_APPROVED)
    (asserts! (not (get executed task)) ERR_ALREADY_EXECUTED)

    (map-set Tasks id (merge task {approvals: (+ (get approvals task) u1)}))
    (map-insert Approvals {taskId: id, who: tx-sender} true)
    (ok true)
  )
)

;; #[allow(unchecked_data)]
(define-public (execute-task (id uint))
  (let
    ((task (unwrap! (get-task id) ERR_UNKNOWN_TASK)))
    (asserts! (is-owner tx-sender) ERR_NOT_AUTHORIZED)
    (asserts! (>= (get approvals task) (get threshold task)) ERR_NOT_APPROVED)
    (asserts! (is-eq contract-caller (get executor task)) ERR_NOT_AUTHORIZED)
    (asserts! (not (get executed task)) ERR_ALREADY_EXECUTED)

    (map-set Tasks id (merge task {executed: true}))
    (ok true)
  )
)

(define-private (can-call (who principal) (what (string-ascii 32)))
  (contract-call? .auth can-call who CONTRACT_ADDRESS what)
)
