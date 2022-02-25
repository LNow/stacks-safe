(define-constant CONTRACT_OWNER tx-sender)
(define-constant CONTRACT_ADDRESS (as-contract tx-sender))
(define-constant DEPLOYED_AT block-height)

(define-constant ERR_NOT_AUTHORIZED (err u5001))
(define-constant ERR_EMPTY_LIST (err u5002))
(define-constant ERR_INCORRECT_THRESHOLD (err u5003))
(define-constant ERR_DUPLICATE_OWNER (err u5004))
(define-constant ERR_ALREADY_SETUP (err u5005))

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

(define-private (new-owner-clojure (who principal) (out (response bool uint)))
  (match out
    okValue (ok (asserts! (map-insert SafeOwners who true) ERR_DUPLICATE_OWNER))
    errValue out
  )
)
