import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Card, Flex, Spin, Tag, Typography } from "antd";
import { RightOutlined } from "@ant-design/icons";
import { api } from "../../api/client";
import { groupLabels, type PageGroup, type PageListItem } from "./pageTypes";

const dateFmt = new Intl.DateTimeFormat("ru-RU", { dateStyle: "short", timeStyle: "short" });

export function PagesListPage() {
  const query = useQuery({
    queryKey: ["pages"],
    queryFn: () => api<{ pages: PageListItem[] }>("/pages").then((r) => r.pages),
  });

  return (
    <>
      <Typography.Title level={2}>Страницы и SEO</Typography.Title>
      <Typography.Paragraph type="secondary">
        Тексты статичных страниц, их адреса и SEO. SEO мероприятий и новостей задаётся в их карточках.
      </Typography.Paragraph>
      {query.isPending ? (
        <Flex justify="center" style={{ padding: 48 }}>
          <Spin />
        </Flex>
      ) : query.isError ? (
        <Typography.Text type="danger">{query.error.message}</Typography.Text>
      ) : (
        (Object.keys(groupLabels) as PageGroup[]).map((group) => (
          <Card key={group} title={groupLabels[group]} size="small" style={{ marginBottom: 16 }} styles={{ body: { padding: 0 } }}>
            {query.data
              .filter((p) => p.group === group)
              .map((p) => (
                <Link key={p.key} to={`/pages/${p.key}`} style={{ color: "inherit", display: "block" }}>
                  <Flex align="center" gap={12} wrap style={{ padding: "12px 16px", borderBottom: "1px solid #f5f5f5" }}>
                    <div style={{ flex: "1 1 240px", minWidth: 0 }}>
                      <div>{p.title}</div>
                      <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                        {p.path ?? "без адреса"}
                        {p.updatedAt ? ` · изменена ${dateFmt.format(new Date(p.updatedAt))}` : ""}
                      </Typography.Text>
                    </div>
                    <Flex gap={4} wrap>
                      {!p.filled && <Tag color="warning">Не заполнена</Tag>}
                      {p.filled && !p.hasSeo && <Tag>Нет SEO</Tag>}
                      {p.hasSeo && <Tag color="success">SEO заполнено</Tag>}
                    </Flex>
                    <RightOutlined style={{ color: "#bfbfbf" }} />
                  </Flex>
                </Link>
              ))}
          </Card>
        ))
      )}
    </>
  );
}
