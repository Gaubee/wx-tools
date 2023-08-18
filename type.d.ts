/// https://transform.tools/json-to-typescript
export type PostItem = {
    objectId: string;
    createTime: number;
    likeCount: number;
    commentCount: number;
    readCount: number;
    forwardCount: number;
    favCount: number;
    commentClose: number;
    visibleType: number;
    status: number;
    desc: {
        media: Array<{
            spec: Array<any>;
            url: string;
            thumbUrl: string;
            mediaType: number;
            videoPlayLen: number;
            width: number;
            height: number;
            md5sum: string;
            fileSize: number;
            bitrate: number;
            coverUrl: string;
            fullThumbUrl: string;
            fullUrl: string;
            fullWidth: number;
            fullHeight: number;
            fullMd5sum: string;
            fullFileSize: number;
            fullBitrate: number;
            halfRect: {};
            fullCoverUrl: string;
            cardShowStyle: number;
        }>;
        mentionedMusics: Array<any>;
        shortTitle: Array<any>;
        description: string;
        mediaType: number;
        location: {
            longitude: number;
            latitude: number;
            city: string;
            poiName: string;
            poiAddress: string;
            poiClassifyId: string;
            poiClassifyType: number;
        };
        extReading: {
            type: number;
            style: number;
        };
        topic: {
            finderTopicInfo: string;
        };
        feedLocation: {
            longitude: number;
            latitude: number;
        };
        event: {
            eventTopicId: string;
            eventName: string;
            eventCreatorNickname: string;
            eventAttendCount: number;
        };
        audio: {};
    };
    objectType: number;
    attachList: {
        attachments: Array<any>;
    };
    flag: number;
    objectNonce: string;
    permissionFlag: number;
    canSetOriginalsoundTitle: boolean;
    fullPlayRate: number;
    avgPlayTimeSec: number;
    disableInfo: {
        isDisabled: boolean;
    };
    showOriginal: boolean;
    exportId: string;
    ringsetCount: number;
    snscoverCount: number;
    statusrefCount: number;
    forwardAggregationCount: number;
    originalInfo: {
        auditOriginalFlag: number;
    };
    followCount: number;
};

export type UserInfo = {
    userAttr: {
        nickname: string;
        username: string;
        encryptedUsername: string;
        encryptedHeadImage: string;
        city: string;
        sex: number;
        country: string;
        province: string;
        spamflag: number;
        spamflag2: number;
    };
    finderUser: {
        finderUsername: string;
        nickname: string;
        headImgUrl: string;
        coverImgUrl: string;
        spamFlag: number;
        acctType: number;
        authIconType: number;
        adminNickname: string;
        feedsCount: number;
        fansCount: number;
        categoryFlag: string;
        acctStatus: number;
        uniqId: string;
        isMasterFinder: boolean;
    };
    datacenterEntarnce: number;
    envInfo: {
        cdnHostList: Array<string>;
        spareCdnHostList: Array<string>;
        productEnv: number;
        cdnHost: string;
        uploadVersion: number;
    };
    livesvrEnter: number;
    switchInfo: {
        commentSelection: number;
        asyncClipPostSwitch: number;
        originalsoundSwitch: number;
        personalmsgFlag: number;
        selectionSwitch: number;
        editCommentAuthSwitch: number;
        userAttrReplayPrivilege: number;
        canCreateReplayTransition: number;
        enableH265Upload: number;
    };
    entranceInfo: {
        commentManage: number;
        pullstreamliveManage: number;
        s1sFamousEntrance: number;
        authEntrance: number;
        adEntrance: number;
        liveShopEntrance: number;
        livePurchaseEntrance: number;
        liveIncomeEntrance: number;
        liveEcdataEntrance: number;
        eventManageEntrance: number;
        commentSelectionEntrance: number;
        liveroomManageEntrance: number;
        liveNoticeManageEntrance: number;
        collectionEntrance: number;
        originalEntranceInfo: {
            contactAdditionalFlag: number;
            originalWarning: string;
        };
        personalColumnManageEntrance: number;
        shortTitleEntrance: number;
        collectionEntranceInfo: {
            audioCollectionEntranceInfo: number;
        };
        musicEntranceInfo: {
            musicManagerEntrance: number;
            takedownSongButtonEntrance: number;
            takedownAlbumButtonEntrance: number;
            bindButtonEntrance: number;
        };
        replayEntrance: number;
        promotionEntrance: number;
        liveleadsEntrance: number;
        mpUrlPostEntrance: number;
        memberEntranceInfo: {
            memberManagerEntrance: number;
        };
        openMenu: number;
        tencentVideoPostEntrance: number;
        audioEntranceInfo: {
            audioManagerEntrance: number;
        };
        thirdpartyPushStreamEntranceInfo: number;
        openUpdateWwkf: number;
    };
    isRealName: boolean;
    authInfo: {
        authIconType: number;
        authVerifyIdentity: number;
        currentYearAuthTimes: number;
        simpleAuthStatus: number;
        authAnnualReview: {
            status: number;
        };
    };
    signature: string;
    proxyUid: string;
    txvideoOpenId: string;
};

export type QueryResult = Array<{
    user: UserInfo;
    list: Array<PostItem>;
}>;

export type AuthorsResult = Array<string>;

export type WeChatChannelsApiResponse<T> = {
    data: T;
    errCode: number;
    errMsg: string;
};
