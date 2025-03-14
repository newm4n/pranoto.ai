import { type KeyboardEventHandler, useState } from "react";
import Head from "next/head";
import {
  Alert,
  Button,
  Card,
  Col,
  Empty,
  Form,
  Input,
  Layout,
  Modal,
  Row,
  Skeleton,
  Space,
  Tag,
  Typography,
  Upload,
  message,
} from "antd";
import { UploadOutlined } from "@ant-design/icons";
import useSWR from "swr";
import { formatDistanceToNow, fromUnixTime } from "date-fns";
import { object, string } from "yup";
import axios from "axios";
import { RcFile } from "antd/es/upload";
import { type Video, VideoStatus } from "@prisma/client";
import { axiosInstance, fetcher } from "@/pkg/fetcher";

const { Meta } = Card;
const { Content, Header, Footer } = Layout;
const { Title } = Typography;

export default function Home() {
  const [search, setSearch] = useState<string>("");
  const { data, error, isLoading, mutate } = useSWR(
    search ? `/v1/videos?q=${search}` : "/v1/videos",
    fetcher
  );
  const handleSearch: KeyboardEventHandler<HTMLInputElement> = (e) => {
    e.preventDefault();

    setSearch(search);
  };

  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const showModal = () => {
    setIsModalOpen(true);
  };

  return (
    <>
      <Head>
        <title>Pranoto.ai</title>
        <meta name="description" content="Video platform powered by AI" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <Layout>
        <Header>
          <Row gutter={[24, 24]}>
            <Col span={12}>
              <Input
                placeholder="Search..."
                onChange={(e) => setSearch(e.target.value)}
                onPressEnter={handleSearch}
              />
            </Col>
            <Col span={6} offset={6} style={{ textAlign: "right" }}>
              <Button type="primary" onClick={showModal}>
                Upload
              </Button>
            </Col>
          </Row>
        </Header>
        <Content style={{ padding: "1.5rem 3rem" }}>
          <Title level={1}>Videos</Title>
          <VideoList error={error} isLoading={isLoading} videos={data?.data} />
          <Modal
            title="Add a video"
            open={isModalOpen}
            onCancel={() => setIsModalOpen(false)}
            footer={false}
          >
            <AddVideoForm
              onSuccess={() => {
                mutate();
                setIsModalOpen(false);
              }}
            />
          </Modal>
        </Content>
        <Footer style={{ textAlign: "center" }}>
          Pranoto.ai ©2023 Created by{" "}
          <a
            href="https://hyperjump.tech/"
            target="_blank"
            rel="noopener noreferrer"
          >
            Hyperjump
          </a>
        </Footer>
      </Layout>
    </>
  );
}

type AddVideoFormProps = {
  onSuccess: () => void;
};

function AddVideoForm({ onSuccess }: AddVideoFormProps) {
  const [form] = Form.useForm();
  const [validationErrors, setValidationErrors] = useState<
    Record<string, string>
  >({});
  const [videoFile, setVideoFile] = useState<RcFile | null>(null);
  const [isSubmitting, setSubmitting] = useState<boolean>(false);
  const onFinish = async (values: Pick<Video, "title">) => {
    // prevent double submit
    if (isSubmitting) {
      return;
    }
    setSubmitting(true);

    // validate input
    try {
      if (!videoFile) {
        setValidationErrors({ video: "Video is required" });
        return;
      }

      const videoSchema = object({
        title: string().required().label("Title"),
      }).noUnknown();

      await videoSchema.validate(values, { abortEarly: false });
    } catch (error: any) {
      let errors: Record<string, string> = {};

      error.inner.forEach((error: any) => {
        errors[error.path] = error.message;
      });

      setValidationErrors(errors);
      return;
    } finally {
      setSubmitting(false);
    }

    // create video
    try {
      const { data } = await axiosInstance.post("/v1/videos", {
        type: videoFile.type,
        title: values.title,
      });

      // upload video to object storage
      const { id, presignedURL } = data.data;
      await axios.put(presignedURL, videoFile);

      // update the video url
      const video = {
        status: VideoStatus.QUEUEING,
        text: "",
        title: values.title,
        url: presignedURL.split("?")[0],
      };
      await axiosInstance.put(`/v1/videos/${id}`, video);

      onSuccess();

      // reset form
      setVideoFile(null);
      form.resetFields();

      message.success("Video has been uploaded.");
    } catch (error: any) {
      console.error(error);

      if (error.response) {
        message.error(error.response.data.error);
        return;
      }

      message.error("Failed to create video. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Form form={form} layout="vertical" onFinish={onFinish}>
      <Form.Item
        label="Title"
        name="title"
        validateStatus={validationErrors?.title ? "error" : ""}
        help={validationErrors?.title}
      >
        <Input status={validationErrors?.title ? "error" : ""} />
      </Form.Item>
      <Form.Item
        label="Video"
        validateStatus={validationErrors?.video ? "error" : ""}
        help={validationErrors?.video}
      >
        <Upload
          accept="video/*"
          name="videoFile"
          multiple={false}
          beforeUpload={(file) => {
            setVideoFile(file);
            setValidationErrors((ve) => {
              delete ve["video"];
              return ve;
            });
            return false;
          }}
          onRemove={() => {
            setVideoFile(null);
          }}
          showUploadList={false}
        >
          <Button icon={<UploadOutlined />}>Choose a Video</Button>
          {videoFile && (
            <div
              style={{
                overflow: "hidden",
                paddingTop: "0.5rem",
              }}
            >
              <video controls style={{ width: "100%" }}>
                <source
                  src={URL.createObjectURL(videoFile)}
                  type={videoFile.type}
                />
              </video>
            </div>
          )}
        </Upload>
      </Form.Item>
      <Form.Item>
        <Button
          type="primary"
          htmlType="submit"
          disabled={isSubmitting}
          loading={isSubmitting}
        >
          Upload
        </Button>
      </Form.Item>
    </Form>
  );
}

type VideoListProps = {
  error: string;
  isLoading: boolean;
  videos: Video[];
};

function VideoList({ error, isLoading, videos }: VideoListProps) {
  if (error) {
    return (
      <Alert
        message="Error!"
        description=" Failed to get video data. Please try again."
        type="error"
      />
    );
  }

  if (isLoading) {
    return (
      <Row gutter={[24, 24]}>
        <Col span={8}>
          <Card>
            <Skeleton loading active />
          </Card>
        </Col>
      </Row>
    );
  }

  if (videos.length === 0) {
    return (
      <Empty description="You have no video at the moment. Click Upload button to add a new one." />
    );
  }

  return (
    <Row gutter={[24, 24]}>
      {videos.map(({ createdAt, id, status, title, type, url }) => (
        <Col key={id} span={8}>
          <Card>
            <video controls style={{ width: "100%", paddingBottom: "0.5rem" }}>
              <source src={url} type={type} />
            </video>
            <Meta
              title={title}
              description={
                <Space>
                  {formatDistanceToNow(fromUnixTime(createdAt), {
                    addSuffix: true,
                  })}
                  {status !== VideoStatus.TRANSCRIBED && (
                    <Tag color={getStatusColor(status)}>
                      {capitalize(status)}
                    </Tag>
                  )}
                </Space>
              }
            />
          </Card>
        </Col>
      ))}
    </Row>
  );
}

function getStatusColor(videoStatus: VideoStatus): string {
  switch (videoStatus) {
    case VideoStatus.CONVERTING:
    case VideoStatus.CONVERTED:
    case VideoStatus.TRANSCRIBING:
      return "blue";

    default:
      return "";
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
