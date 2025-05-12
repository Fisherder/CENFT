// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/Base64.sol";

contract MyNFT is ERC721URIStorage, Ownable {
    uint256 private _tokenIds;
    uint256 private _eventIds;

    // 添加管理员映射
    mapping(address => bool) public admins;
    
    // 添加管理员相关事件
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);

    struct Event {
        uint256 id;
        string name;
        string description;
        address organizer;
        uint256 startTime;
        uint256 endTime;
        uint256 maxParticipants;
        uint256 currentParticipants;
        uint8 status; // 0: 待审核, 1: 已通过, 2: 已拒绝, 3: 已结束
        bytes32 qrCodeHash; // 使用bytes32存储哈希值而不是字符串
    }

    mapping(uint256 => Event) public events;
    mapping(uint256 => mapping(address => bool)) public hasCheckedIn;

    event EventCreated(uint256 indexed eventId, string name, address organizer);
    event EventApproved(uint256 indexed eventId);
    event EventRejected(uint256 indexed eventId);
    event CheckedIn(uint256 indexed eventId, address participant, uint256 tokenId);

    constructor() ERC721("Campus Event NFT", "CENFT") Ownable(msg.sender) {
        // 部署者自动成为管理员
        admins[msg.sender] = true;
    }

    // 添加管理员修饰符
    modifier onlyAdmin() {
        require(admins[msg.sender], "Only admin can call this function");
        _;
    }

    // 添加管理员
    function addAdmin(address admin) public onlyOwner {
        require(!admins[admin], "Address is already an admin");
        admins[admin] = true;
        emit AdminAdded(admin);
    }

    // 移除管理员
    function removeAdmin(address admin) public onlyOwner {
        require(admins[admin], "Address is not an admin");
        admins[admin] = false;
        emit AdminRemoved(admin);
    }

    function createEvent(
        string memory name,
        string memory description,
        uint256 startTime,
        uint256 endTime,
        uint256 maxParticipants
    ) public {
        require(startTime > block.timestamp, "Start time must be in the future");
        require(endTime > startTime, "End time must be after start time");
        require(maxParticipants > 0, "Max participants must be greater than 0");

        _eventIds++;
        uint256 eventId = _eventIds;

        events[eventId] = Event({
            id: eventId,
            name: name,
            description: description,
            organizer: msg.sender,
            startTime: startTime,
            endTime: endTime,
            maxParticipants: maxParticipants,
            currentParticipants: 0,
            status: 0,
            qrCodeHash: bytes32(0)
        });

        emit EventCreated(eventId, name, msg.sender);
    }

    function approveEvent(uint256 eventId) public onlyAdmin {
        Event storage event_ = events[eventId];
        require(event_.status == 0, "Event is not pending");
        require(event_.startTime > block.timestamp, "Event has already started");

        event_.status = 1;
        // 生成二维码哈希
        event_.qrCodeHash = keccak256(abi.encodePacked(
            "event_",
            Strings.toString(eventId),
            "_",
            Strings.toString(uint256(uint160(event_.organizer)))
        ));

        emit EventApproved(eventId);
    }

    function rejectEvent(uint256 eventId) public onlyAdmin {
        Event storage event_ = events[eventId];
        require(event_.status == 0, "Event is not pending");

        event_.status = 2;
        emit EventRejected(eventId);
    }

    function checkIn(uint256 eventId, string memory qrCode) public {
        Event storage event_ = events[eventId];
        require(event_.status == 1, "Event is not approved");
        require(block.timestamp >= event_.startTime, "Event has not started");
        require(block.timestamp <= event_.endTime, "Event has ended");
        require(!hasCheckedIn[eventId][msg.sender], "Already checked in");
        require(event_.currentParticipants < event_.maxParticipants, "Event is full");
        require(event_.qrCodeHash == keccak256(bytes(qrCode)), "Invalid QR code");

        hasCheckedIn[eventId][msg.sender] = true;
        event_.currentParticipants++;

        // 创建并分配 NFT
        _tokenIds++;
        uint256 newTokenId = _tokenIds;
        _mint(msg.sender, newTokenId);

        // 设置 NFT 元数据
        string memory uri = string(abi.encodePacked(
            "data:application/json;base64,",
            Base64.encode(bytes(string(abi.encodePacked(
                '{"name":"', event_.name, '",',
                '"description":"', event_.description, '",',
                '"attributes":[',
                '{"trait_type":"Event ID","value":', Strings.toString(eventId), '},',
                '{"trait_type":"Organizer","value":"', Strings.toHexString(uint256(uint160(event_.organizer)), 20), '"},',
                '{"trait_type":"Start Time","value":', Strings.toString(event_.startTime), '},',
                '{"trait_type":"End Time","value":', Strings.toString(event_.endTime), '}',
                ']}'
            ))))
        ));
        _setTokenURI(newTokenId, uri);

        emit CheckedIn(eventId, msg.sender, newTokenId);
    }

    function getEvent(uint256 eventId) public view returns (Event memory) {
        return events[eventId];
    }

    function getEventCount() public view returns (uint256) {
        return _eventIds;
    }
} 