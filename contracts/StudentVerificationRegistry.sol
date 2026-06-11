// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

contract StudentVerificationRegistry is Ownable {
    mapping(address => bool) private trustedIssuers;
    mapping(address => string) private issuerDids;

    mapping(bytes32 => bool) private validSchemas;
    mapping(bytes32 => string) private schemaNames;

    mapping(bytes32 => bool) private registeredCredentials;
    mapping(bytes32 => address) private credentialIssuers;
    mapping(bytes32 => bool) private revokedCredentials;

    event IssuerAdded(address indexed issuer, string did);
    event IssuerRemoved(address indexed issuer);
    event SchemaRegistered(bytes32 indexed schemaHash, string schemaName);
    event CredentialRegistered(bytes32 indexed credentialHash, address indexed issuer);
    event CredentialRevoked(bytes32 indexed credentialHash, address indexed issuer);

    modifier onlyTrustedIssuer() {
        require(trustedIssuers[msg.sender], "caller is not trusted issuer");
        _;
    }

    modifier onlyCredentialIssuer(bytes32 credentialHash) {
        require(credentialHash != bytes32(0), "credential hash zero");
        require(registeredCredentials[credentialHash], "credential not registered");
        require(
            credentialIssuers[credentialHash] == msg.sender,
            "caller is not credential issuer"
        );
        _;
    }

    constructor() Ownable(msg.sender) {}

    function addIssuer(address issuer, string calldata did) external onlyOwner {
        require(issuer != address(0), "issuer zero address");
        require(bytes(did).length > 0, "issuer DID empty");

        trustedIssuers[issuer] = true;
        issuerDids[issuer] = did;

        emit IssuerAdded(issuer, did);
    }

    function removeIssuer(address issuer) external onlyOwner {
        require(issuer != address(0), "issuer zero address");

        trustedIssuers[issuer] = false;
        delete issuerDids[issuer];

        emit IssuerRemoved(issuer);
    }

    function isTrustedIssuer(address issuer) external view returns (bool) {
        return trustedIssuers[issuer];
    }

    function getIssuerDid(address issuer) external view returns (string memory) {
        return issuerDids[issuer];
    }

    function registerSchema(
        bytes32 schemaHash,
        string calldata schemaName
    ) external onlyOwner {
        require(schemaHash != bytes32(0), "schema hash zero");
        require(bytes(schemaName).length > 0, "schema name empty");
        require(!validSchemas[schemaHash], "schema already registered");

        validSchemas[schemaHash] = true;
        schemaNames[schemaHash] = schemaName;

        emit SchemaRegistered(schemaHash, schemaName);
    }

    function isValidSchema(bytes32 schemaHash) external view returns (bool) {
        return validSchemas[schemaHash];
    }

    function getSchemaName(bytes32 schemaHash) external view returns (string memory) {
        return schemaNames[schemaHash];
    }

    function registerCredential(
        bytes32 credentialHash
    ) external onlyTrustedIssuer {
        require(credentialHash != bytes32(0), "credential hash zero");
        require(
            !registeredCredentials[credentialHash],
            "credential already registered"
        );

        registeredCredentials[credentialHash] = true;
        credentialIssuers[credentialHash] = msg.sender;

        emit CredentialRegistered(credentialHash, msg.sender);
    }

    function isRegisteredCredential(
        bytes32 credentialHash
    ) external view returns (bool) {
        return registeredCredentials[credentialHash];
    }

    function getCredentialIssuer(
        bytes32 credentialHash
    ) external view returns (address) {
        return credentialIssuers[credentialHash];
    }

    function revokeCredential(
        bytes32 credentialHash
    ) external onlyCredentialIssuer(credentialHash) {
        require(!revokedCredentials[credentialHash], "credential already revoked");

        revokedCredentials[credentialHash] = true;

        emit CredentialRevoked(credentialHash, msg.sender);
    }

    function isRevoked(bytes32 credentialHash) external view returns (bool) {
        return revokedCredentials[credentialHash];
    }
}
